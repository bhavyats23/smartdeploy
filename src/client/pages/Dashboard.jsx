import React, { useState, useEffect } from "react";

export default function Dashboard({ user }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(null);
  const [deployStatus, setDeployStatus] = useState({});

  useEffect(() => {
    fetch("/api/repos", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setRepos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDeploy = async (repo) => {
    setDeploying(repo.id);
    setDeployStatus((prev) => ({ ...prev, [repo.id]: "starting" }));

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ repoName: repo.name }),
      });
      const data = await res.json();

      if (data.success) {
        const stages = [
          "building",
          "testing",
          "quality",
          "docker",
          "deploying",
          "live",
        ];
        for (let i = 0; i < stages.length; i++) {
          await new Promise((r) => setTimeout(r, 1200));
          setDeployStatus((prev) => ({ ...prev, [repo.id]: stages[i] }));
        }
      }
    } catch (err) {
      setDeployStatus((prev) => ({ ...prev, [repo.id]: "error" }));
    }
    setDeploying(null);
  };

  const getStatusLabel = (status) => {
    const map = {
      starting: "⏳ Starting pipeline...",
      building: "🔨 Building project...",
      testing: "🧪 Running tests...",
      quality: "🛡️ SonarCloud quality check...",
      docker: "🐳 Building Docker image...",
      deploying: "☁️ Deploying to Railway...",
      live: "✅ Live! URL ready",
      error: "❌ Deployment failed",
    };
    return map[status] || "";
  };

  const getStatusClass = (status) => {
    if (status === "live") return "status-live";
    if (status === "error") return "status-error";
    return "status-running";
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="logo">
          <span className="logo-icon">▲</span>
          <span className="logo-text">SmartDeploy</span>
        </div>
        <div className="nav-right">
          <img
            src={
              user.avatar || "https://avatars.githubusercontent.com/u/9919?v=4"
            }
            alt="avatar"
            className="user-avatar"
          />
          <span className="user-name">{user.username || user.name}</span>
          <a href="/auth/logout" className="logout-btn">
            Logout
          </a>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="welcome-banner">
          <div>
            <h1 className="welcome-title">
              Welcome, {user.username || user.name}! 👋
            </h1>
            <p className="welcome-sub">
              Select any repository and click Deploy to go live instantly.
            </p>
          </div>
          <div className="banner-stats">
            <div className="stat">
              <span className="stat-num">{repos.length}</span>
              <span className="stat-label">Repositories</span>
            </div>
            <div className="stat">
              <span className="stat-num">0</span>
              <span className="stat-label">Deployed</span>
            </div>
          </div>
        </div>

        <div className="pipeline-bar">
          <div className="pipeline-bar-step done">① GitHub</div>
          <div className="pipeline-bar-arrow">→</div>
          <div className="pipeline-bar-step">② Build</div>
          <div className="pipeline-bar-arrow">→</div>
          <div className="pipeline-bar-step">③ Test</div>
          <div className="pipeline-bar-arrow">→</div>
          <div className="pipeline-bar-step">④ Quality</div>
          <div className="pipeline-bar-arrow">→</div>
          <div className="pipeline-bar-step">⑤ Docker</div>
          <div className="pipeline-bar-arrow">→</div>
          <div className="pipeline-bar-step">⑥ 🚀 Live</div>
        </div>

        <div className="section-title">Your Repositories</div>

        {loading ? (
          <div className="loading-repos">Loading your repositories...</div>
        ) : (
          <div className="repos-grid">
            {repos.map((repo) => (
              <div key={repo.id} className="repo-card">
                <div className="repo-card-top">
                  <div className="repo-name">
                    <span className="repo-icon">📁</span>
                    {repo.name}
                  </div>
                  <span className="repo-lang">
                    {repo.language || "Unknown"}
                  </span>
                </div>

                <div className="repo-updated">Updated: {repo.updated_at}</div>

                {deployStatus[repo.id] && (
                  <div
                    className={`deploy-status ${getStatusClass(deployStatus[repo.id])}`}
                  >
                    {getStatusLabel(deployStatus[repo.id])}
                  </div>
                )}

                <button
                  className={`deploy-btn ${deploying === repo.id ? "deploying" : ""}`}
                  onClick={() => handleDeploy(repo)}
                  disabled={deploying !== null}
                >
                  {deploying === repo.id ? "Deploying..." : "🚀 Deploy"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
