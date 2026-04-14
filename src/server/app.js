const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
require("dotenv").config();

const app = express();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "smartdeploy_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        "http://localhost:5000/auth/github/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const user = {
        id: profile.id,
        username: profile.username,
        name: profile.displayName || profile.username,
        avatar: profile.photos?.[0]?.value || "",
        email: profile.emails?.[0]?.value || "",
        accessToken,
        photos: profile.photos || [],
        displayName: profile.displayName || profile.username,
      };
      return done(null, user);
    },
  ),
);

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SmartDeploy running!",
    time: new Date().toISOString(),
  });
});

app.get("/auth/user", (req, res) => {
  if (req.isAuthenticated()) return res.json(req.user);
  res.status(401).json({ error: "Not logged in" });
});

app.get("/api/auth/status", (req, res) => {
  if (req.isAuthenticated())
    return res.json({ loggedIn: true, user: req.user });
  res.json({ loggedIn: false, user: null });
});

app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email", "repo"] }),
);

app.get(
  "/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: CLIENT_URL + "?error=auth_failed",
  }),
  (req, res) => {
    res.redirect(CLIENT_URL);
  },
);

app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    res.redirect(CLIENT_URL);
  });
});

app.get("/api/repos", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Not logged in" });
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
        description: r.description || "",
        language: r.language || null,
        updated_at: r.updated_at?.split("T")[0],
        private: r.private,
        url: r.html_url,
        stargazers_count: r.stargazers_count || 0,
      })),
    );
  } catch (err) {
    console.error("GitHub API error:", err);
    res.status(500).json({ error: "Failed to fetch repos" });
  }
});

const { exec } = require("child_process");

app.post("/api/deploy", (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Not logged in" });
  const { repoName } = req.body;
  const dockerUser = "bhavyats23";
  const imageName = `${dockerUser}/${repoName.toLowerCase()}`;
  const jobId = "job_" + Date.now();
  console.log(`🚀 Deploy started for: ${repoName}`);
  res.json({ success: true, jobId, imageName });
  const commands = [
    `docker build -t ${imageName} .`,
    `docker login -u ${dockerUser} -p ${process.env.DOCKER_PASSWORD}`,
    `docker push ${imageName}`,
  ].join(" && ");
  exec(commands, { cwd: process.cwd() }, (error, stdout) => {
    if (error) {
      console.error(`❌ Deploy failed:`, error.message);
      return;
    }
    console.log(`✅ Deploy success for ${repoName}`);
    console.log(stdout);
  });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../dist")));
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, "../../dist/index.html"));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ SmartDeploy running on port ${PORT}`);
});
