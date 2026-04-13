import { useEffect, useState } from "react";

const PIPELINE_STEPS = [
  "Clone",
  "Install",
  "Test",
  "Docker Build",
  "Push",
  "Deploy",
];

export default function Dashboard({ user }) {
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [deployingRepo, setDeployingRepo] = useState(null);
  const [deployStatus, setDeployStatus] = useState({});
  const [logs, setLogs] = useState([]);
  const [pipelineStep, setPipelineStep] = useState(-1);

  // Fetch real GitHub repos
  useEffect(() => {
    fetch("/api/repos", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setRepos(Array.isArray(data) ? data : []);
        setLoadingRepos(false);
      })
      .catch(() => setLoadingRepos(false));
  }, []);

  // Simulate deploy pipeline (Day 4 will make this real)
  const handleDeploy = async (repo) => {
    setDeployingRepo(repo.name);
    setLogs([]);
    setPipelineStep(0);

    const addLog = (msg) =>
      setLogs((prev) => [
        ...prev,
        { text: msg, time: new Date().toLocaleTimeString() },
      ]);

    const steps = [
      { label: "Cloning repository...", delay: 800 },
      { label: "Installing dependencies...", delay: 1200 },
      { label: "Running tests...", delay: 1000 },
      { label: "Building Docker image...", delay: 1500 },
      { label: "Pushing to DockerHub...", delay: 1200 },
      { label: "Deploying to Railway...", delay: 1000 },
    ];

    for (let i = 0; i < steps.length; i++) {
      setPipelineStep(i);
      addLog(`[${PIPELINE_STEPS[i].toUpperCase()}] ${steps[i].label}`);
      await new Promise((r) => setTimeout(r, steps[i].delay));
    }

    addLog(
      "✅ Deployment complete! Live at https://smartdeploy.up.railway.app",
    );
    setDeployStatus((prev) => ({ ...prev, [repo.name]: "live" }));
    setDeployingRepo(null);
    setPipelineStep(-1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="dashboard">
      {/* ── Top Nav ── */}
      <nav className="dashboard-nav">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">SmartDeploy</span>
        </div>
        <div className="nav-right">
          {user?.photos?.[0]?.value && (
            <img
              src={user.photos[0].value}
              alt="avatar"
              className="user-avatar"
            />
          )}
          <span className="user-name">
            {user?.username || user?.displayName}
          </span>
          <a href="/auth/logout" className="logout-btn">
            Logout
          </a>
        </div>
      </nav>

      <div className="dashboard-main">
        {/* ── Welcome Banner ── */}
        <div className="welcome-banner">
          <div>
            <div className="welcome-title">
              Welcome back,{" "}
              <span style={{ color: "var(--green)" }}>
                {user?.username || user?.displayName}
              </span>{" "}
              👋
            </div>
            <div className="welcome-sub">
              Your CI/CD pipeline is ready. Select a repo and deploy.
            </div>
          </div>
          <div className="banner-stats">
            <div className="stat">
              <span className="stat-num">{repos.length}</span>
              <span className="stat-label">Repos</span>
            </div>
            <div className="stat">
              <span className="stat-num">
                {Object.values(deployStatus).filter((s) => s === "live").length}
              </span>
              <span className="stat-label">Live</span>
            </div>
            <div className="stat">
              <span className="stat-num">0</span>
              <span className="stat-label">Errors</span>
            </div>
          </div>
        </div>

        {/* ── Pipeline Bar ── */}
        <div className="pipeline-bar">
          {PIPELINE_STEPS.map((step, i) => (
            <span key={step}>
              <span
                className={`pipeline-bar-step ${
                  pipelineStep > i ? "done" : pipelineStep === i ? "done" : ""
                }`}
                style={
                  pipelineStep === i
                    ? { color: "#fff", background: "rgba(0,255,136,0.15)" }
                    : {}
                }
              >
                {pipelineStep > i ? "✓ " : pipelineStep === i ? "⟳ " : ""}
                {step}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="pipeline-bar-arrow">→</span>
              )}
            </span>
          ))}
        </div>

        {/* ── Two column layout: Repos + Logs ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* ── Repos Grid ── */}
          <div>
            <div className="section-title">Your Repositories</div>
            {loadingRepos ? (
              <div className="loading-repos">Loading repos...</div>
            ) : repos.length === 0 ? (
              <div className="loading-repos">No repos found.</div>
            ) : (
              <div className="repos-grid">
                {repos.map((repo) => (
                  <div key={repo.id} className="repo-card">
                    <div className="repo-card-top">
                      <div className="repo-name">
                        <span className="repo-icon">📁</span>
                        {repo.name}
                      </div>
                      {repo.language && (
                        <span className="repo-lang">{repo.language}</span>
                      )}
                    </div>

                    {repo.description && (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--gray-400)",
                          lineHeight: 1.5,
                        }}
                      >
                        {repo.description}
                      </p>
                    )}

                    <div className="repo-updated">
                      Updated {formatDate(repo.updated_at)}
                    </div>

                    {deployStatus[repo.name] === "live" && (
                      <div className="deploy-status status-live">
                        ● Live — deployed successfully
                      </div>
                    )}
                    {deployingRepo === repo.name && (
                      <div className="deploy-status status-running">
                        ⟳ Deploying...
                      </div>
                    )}

                    <button
                      className="deploy-btn"
                      onClick={() => handleDeploy(repo)}
                      disabled={!!deployingRepo}
                    >
                      {deployingRepo === repo.name
                        ? "Deploying..."
                        : deployStatus[repo.name] === "live"
                          ? "Redeploy"
                          : "🚀 Deploy"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Live Logs Panel ── */}
          <div style={{ position: "sticky", top: "80px" }}>
            <div className="section-title">Live Logs</div>
            <div
              style={{
                background: "#000",
                border: "1px solid var(--border2)",
                borderRadius: "12px",
                padding: "20px",
                height: "520px",
                overflowY: "auto",
                fontFamily: "'Space Mono', monospace",
                fontSize: "12px",
                lineHeight: "1.8",
              }}
            >
              {logs.length === 0 ? (
                <span style={{ color: "var(--gray-600)" }}>
                  // Waiting for deployment...
                </span>
              ) : (
                logs.map((log, i) => (
                  <div key={i}>
                    <span style={{ color: "var(--gray-600)" }}>
                      [{log.time}]
                    </span>{" "}
                    <span
                      style={{
                        color: log.text.startsWith("✅")
                          ? "var(--green)"
                          : "#e0e0e0",
                      }}
                    >
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
