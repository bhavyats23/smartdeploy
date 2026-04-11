const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
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
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false, user: null });
  }
});

app.get("/auth/github", (req, res) => {
  req.session.user = {
    id: "test_123",
    username: "TestDeveloper",
    avatar: "https://avatars.githubusercontent.com/u/9919?v=4",
    name: "Test Developer",
  };
  res.redirect(process.env.CLIENT_URL || "http://localhost:3000");
});

app.get("/auth/logout", (req, res) => {
  req.session.destroy();
  res.redirect(process.env.CLIENT_URL || "http://localhost:3000");
});

// ─── Repos Route ──────────────────────────────────────────────────────────────
app.get("/api/repos", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json([
    {
      id: 1,
      name: "my-portfolio",
      language: "JavaScript",
      updated_at: "2024-01-10",
    },
    { id: 2, name: "todo-app", language: "React", updated_at: "2024-01-08" },
    { id: 3, name: "flask-api", language: "Python", updated_at: "2024-01-05" },
  ]);
});

// ─── Deploy Route ─────────────────────────────────────────────────────────────
app.post("/api/deploy", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const { repoName } = req.body;
  console.log(`Deploy triggered for: ${repoName}`);
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
  console.log(`  👉 Server URL : http://localhost:${PORT}`);
  console.log(`  👉 Health check: http://localhost:${PORT}/api/health`);
  console.log("");
});
