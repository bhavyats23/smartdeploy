require("dotenv").config();
const mongoose = require("mongoose");
const Deployment = require("./models/Deployment");
const { sendDeploymentEmail } = require("./emailService");
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;

const app = express();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "smartdeploy_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
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
        "http://localhost:3000/auth/github/callback",
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

// ==================== HEALTH CHECK ====================
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SmartDeploy running!",
    time: new Date().toISOString(),
  });
});

// ==================== AUTH ROUTES ====================
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
    res.redirect(CLIENT_URL + "/dashboard");
  },
);

app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    res.redirect(CLIENT_URL);
  });
});

// ==================== GITHUB REPOS ====================
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

// ==================== TRIGGER JENKINS PIPELINE ====================
app.post("/api/deploy", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Not logged in" });

  const { repoName, repoUrl } = req.body;
  const fullRepoUrl =
    repoUrl || `https://github.com/${req.user.username}/${repoName}`;

  console.log(`🚀 Deploy started for: ${repoName} — ${fullRepoUrl}`);

  const jenkinsUrl = process.env.JENKINS_URL;
  const jenkinsUser = process.env.JENKINS_USER;
  const jenkinsToken = process.env.JENKINS_TOKEN;
  const credentials = Buffer.from(`${jenkinsUser}:${jenkinsToken}`).toString(
    "base64",
  );

  try {
    // Trigger Jenkins with repo URL as a parameter
    const triggerUrl = `${jenkinsUrl}/job/smartdeploy-pipeline/buildWithParameters?REPO_URL=${encodeURIComponent(fullRepoUrl)}&REPO_NAME=${encodeURIComponent(repoName)}`;

    const response = await fetch(triggerUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if ([200, 201, 302].includes(response.status)) {
      // Save deployment to MongoDB
      const deployment = new Deployment({
        repoName: repoName,
        repoUrl: fullRepoUrl,
        status: "running",
        triggeredBy: req.user.username,
      });
      await deployment.save();

      console.log(`✅ Jenkins triggered + saved to MongoDB for ${repoName}`);

      // Send start email
      try {
        await sendDeploymentEmail(
          repoName,
          "started",
          `Jenkins pipeline triggered for ${fullRepoUrl}. Build is now running...`,
        );
        console.log(`📧 Start email sent for ${repoName}`);
      } catch (emailErr) {
        console.error("📧 Email error (non-fatal):", emailErr.message);
      }

      res.json({
        success: true,
        deploymentId: deployment._id,
        message: "Jenkins pipeline triggered!",
      });
    } else {
      console.error(`❌ Jenkins returned status: ${response.status}`);
      res.status(500).json({
        error: `Failed to trigger Jenkins (status ${response.status})`,
      });
    }
  } catch (err) {
    console.error("❌ Jenkins error:", err.message);
    res.status(500).json({ error: "Could not connect to Jenkins" });
  }
});

// ==================== GET BUILD STATUS + LIVE URL ====================
app.get("/api/deploy/status", async (req, res) => {
  const jenkinsUrl = process.env.JENKINS_URL;
  const jenkinsUser = process.env.JENKINS_USER;
  const jenkinsToken = process.env.JENKINS_TOKEN;
  const credentials = Buffer.from(`${jenkinsUser}:${jenkinsToken}`).toString(
    "base64",
  );

  try {
    const response = await fetch(
      `${jenkinsUrl}/job/smartdeploy-pipeline/lastBuild/api/json`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      },
    );
    const data = await response.json();

    // Extract LIVE_URL from Jenkins console output
    let liveUrl = null;
    try {
      const logRes = await fetch(
        `${jenkinsUrl}/job/smartdeploy-pipeline/lastBuild/consoleText`,
        { headers: { Authorization: `Basic ${credentials}` } },
      );
      const logText = await logRes.text();

      // Look for LIVE_URL line in console
      const urlMatch = logText.match(/LIVE_URL=(https:\/\/[^\s\r\n]+)/);
      if (urlMatch) {
        liveUrl = urlMatch[1];
        console.log(`🔗 Live URL found: ${liveUrl}`);
      }
    } catch (logErr) {
      console.error("Could not fetch Jenkins log:", logErr.message);
    }

    // Update MongoDB deployment record when build finishes
    if (data.result) {
      const updateData = {
        status: data.result === "SUCCESS" ? "success" : "failed",
        jenkinsBuildNumber: data.number,
        completedAt: new Date(),
      };

      // Save live URL if found
      if (liveUrl) updateData.liveUrl = liveUrl;

      const updatedDeployment = await Deployment.findOneAndUpdate(
        { status: "running" },
        updateData,
        { sort: { triggeredAt: -1 }, new: true },
      );

      // Send completion email
      if (updatedDeployment) {
        const emailStatus = data.result === "SUCCESS" ? "success" : "failed";
        const logs =
          data.result === "SUCCESS"
            ? `✅ Build #${data.number} completed successfully!\n🔗 Live URL: ${liveUrl || "Check Railway dashboard"}`
            : `❌ Build #${data.number} failed. Please check Jenkins for details.`;

        try {
          await sendDeploymentEmail(
            updatedDeployment.repoName,
            emailStatus,
            logs,
          );
          console.log(`📧 Completion email sent — ${emailStatus}`);
        } catch (emailErr) {
          console.error("📧 Email error (non-fatal):", emailErr.message);
        }
      }
    }

    res.json({
      building: data.building,
      result: data.result,
      duration: data.duration,
      number: data.number,
      liveUrl: liveUrl,
    });
  } catch (err) {
    console.error("Status check error:", err.message);
    res.status(500).json({ error: "Could not get build status" });
  }
});

// ==================== GET DEPLOYMENT HISTORY ====================
app.get("/api/deployments", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Not logged in" });
  try {
    const deployments = await Deployment.find()
      .sort({ triggeredAt: -1 })
      .limit(20);
    res.json(deployments);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deployments" });
  }
});

// ==================== GET STATS FOR DASHBOARD ====================
app.get("/api/stats", async (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ error: "Not logged in" });
  try {
    const total = await Deployment.countDocuments();
    const success = await Deployment.countDocuments({ status: "success" });
    const failed = await Deployment.countDocuments({ status: "failed" });
    const running = await Deployment.countDocuments({ status: "running" });
    res.json({ total, success, failed, running });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ==================== SERVE REACT FRONTEND ====================
if (isProduction) {
  const distPath = path.join(__dirname, "../../dist");
  app.use(express.static(distPath));
  app.get("*splat", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/auth")) {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
}

const PORT = process.env.PORT || 3000;

// Connect to MongoDB FIRST, then start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected!");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });
