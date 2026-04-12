const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
require("dotenv").config();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "smartdeploy_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// ─── Passport Setup ───────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
    },
    function (accessToken, refreshToken, profile, done) {
      const user = {
        id: profile.id,
        username: profile.username,
        name: profile.displayName || profile.username,
        avatar: profile.photos[0]?.value || "",
        email: profile.emails?.[0]?.value || "",
        accessToken: accessToken,
      };
      return done(null, user);
    },
  ),
);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SmartDeploy server is running!",
    time: new Date().toISOString(),
  });
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.get("/api/auth/status", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user });
  } else {
    res.json({ loggedIn: false, user: null });
  }
});

// Step 1 — redirect to GitHub
app.get(
  "/auth/github",
  passport.authenticate("github", {
    scope: ["user:email", "repo"],
  }),
);

// Step 2 — GitHub redirects back here
app.get(
  "/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: process.env.CLIENT_URL + "?error=auth_failed",
  }),
  (req, res) => {
    // Success — send user to dashboard
    res.redirect(process.env.CLIENT_URL + "/dashboard");
  },
);

// Logout
app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    res.redirect(process.env.CLIENT_URL || "http://localhost:3000");
  });
});

// ─── Repos Route ──────────────────────────────────────────────────────────────
app.get("/api/repos", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=20",
      {
        headers: {
          Authorization: `Bearer ${req.user.accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );
    const repos = await response.json();
    res.json(
      repos.map((r) => ({
        id: r.id,
        name: r.name,
        language: r.language || "Unknown",
        updated_at: r.updated_at?.split("T")[0],
        private: r.private,
        url: r.html_url,
      })),
    );
  } catch (err) {
    console.error("GitHub API error:", err);
    res.status(500).json({ error: "Failed to fetch repos" });
  }
});

// ─── Deploy Route ─────────────────────────────────────────────────────────────
app.post("/api/deploy", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const { repoName } = req.body;
  console.log(`Deploy triggered for: ${repoName} by ${req.user.username}`);
  res.json({
    success: true,
    message: `Deployment started for ${repoName}`,
    jobId: "job_" + Date.now(),
  });
});

// ─── Production ───────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../../dist/index.html"));
  });
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("");
  console.log("  ✅ SmartDeploy Backend running!");
  console.log(`  👉 Server URL  : http://localhost:${PORT}`);
  console.log(`  👉 Health check: http://localhost:${PORT}/api/health`);
  console.log("");
});
