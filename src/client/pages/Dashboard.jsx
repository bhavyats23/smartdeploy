import { useEffect, useState } from "react";
const PIPELINE_STEPS = ["Clone","Install","Test","Docker Build","Push","Deploy"];
const RENDER_CONFIG = { smartdeploy: { hookUrl: "https://api.render.com/deploy/srv-d7oec7iqqhas73fl9aog?key=IpYlf7lvGJc", serviceId: "srv-d7oec7iqqhas73fl9aog" } };
export default function Dashboard({ user }) {
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [deployingRepo, setDeployingRepo] = useState(null);
  const [deployStatus, setDeployStatus] = useState({});
  const [logs, setLogs] = useState([]);
  const [pipelineStep, setPipelineStep] = useState(-1);
  useEffect(() => {
    fetch("/api/repos", { credentials: "include" }).then(r => r.json()).then(data => { setRepos(Array.isArray(data) ? data : []); setLoadingRepos(false); }).catch(() => setLoadingRepos(false));
  }, []);
  const handleDeploy = async (repo) => {
    setDeployingRepo(repo.name); setLogs([]); setPipelineStep(0);
    const addLog = (msg) => setLogs(prev => [...prev, { text: msg, time: new Date().toLocaleTimeString() }]);
    addLog("[CLONE] Triggering Jenkins pipeline for " + repo.name + "...");
    const renderConfig = RENDER_CONFIG[repo.name] || {};
    try {
      const response = await fetch("/api/deploy", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoName: repo.name, repoUrl: repo.url, renderHookUrl: renderConfig.hookUrl || "", renderServiceId: renderConfig.serviceId || "" }) });
      const data = await response.json();
      if (data.success) {
        addLog("[JENKINS] Pipeline triggered! ID: " + data.deploymentId);
        setPipelineStep(1);
        addLog("[INSTALL] Pipeline is running on Jenkins...");
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          setPipelineStep(prev => Math.min(prev + 1, 4));
          addLog("[RUNNING] Waiting for Jenkins... (" + attempts + "/20)");
          try {
            const depRes = await fetch("/api/deployments", { credentials: "include" });
            const deps = await depRes.json();
            const thisDep = deps.find(d => d.repoName === repo.name);
            if (thisDep && thisDep.status === "success") {
              clearInterval(poll); setPipelineStep(5);
              const liveUrl = thisDep.liveUrl || "";
              setDeployStatus(prev => { const n = {...prev}; n[repo.name] = "live"; n[repo.name + "_url"] = liveUrl; return n; });
              addLog("Deployment complete!");
              if (liveUrl) addLog("Live: " + liveUrl);
              setDeployingRepo(null); setPipelineStep(-1);
            } else if (thisDep && thisDep.status === "failed") {
              clearInterval(poll); addLog("Build failed! Check Jenkins at http://localhost:8080"); setDeployingRepo(null); setPipelineStep(-1);
            } else if (attempts >= 20) {
              clearInterval(poll); addLog("Timeout - check Jenkins at http://localhost:8080"); setDeployingRepo(null); setPipelineStep(-1);
            }
          } catch (err) { clearInterval(poll); addLog("Error: " + err.message); setDeployingRepo(null); setPipelineStep(-1); }
        }, 10000);
      } else { addLog("Failed to trigger Jenkins: " + data.error); setDeployingRepo(null); setPipelineStep(-1); }
    } catch (err) { addLog("Error connecting to server: " + err.message); setDeployingRepo(null); setPipelineStep(-1); }
  };
  const formatDate = (dateStr) => { if (!dateStr) return "-"; const d = new Date(dateStr); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
  const liveCount = Object.keys(deployStatus).filter(k => !k.includes("_url") && deployStatus[k] === "live").length;
  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="logo"><span className="logo-icon">!</span><span className="logo-text">SmartDeploy</span></div>
        <div className="nav-right">
          {user && user.photos && user.photos[0] && <img src={user.photos[0].value} alt="avatar" className="user-avatar" />}
          <span className="user-name">{user && (user.username || user.displayName)}</span>
          <a href="/auth/logout" className="logout-btn">Logout</a>
        </div>
      </nav>
      <div className="dashboard-main">
        <div className="welcome-banner">
          <div>
            <div className="welcome-title">Welcome back, {user && (user.username || user.displayName)}</div>
            <div className="welcome-sub">Your CI/CD pipeline is ready. Select a repo and deploy.</div>
          </div>
          <div className="banner-stats">
            <div className="stat"><span className="stat-num">{repos.length}</span><span className="stat-label">Repos</span></div>
            <div className="stat"><span className="stat-num">{liveCount}</span><span className="stat-label">Live</span></div>
            <div className="stat"><span className="stat-num">0</span><span className="stat-label">Errors</span></div>
          </div>
        </div>
        <div className="pipeline-bar">
          {PIPELINE_STEPS.map((step, i) => (
            <span key={step}>
              <span className={"pipeline-bar-step" + (pipelineStep >= i ? " done" : "")} style={pipelineStep === i ? { color: "#fff", background: "rgba(0,255,136,0.15)" } : {}}>
                {pipelineStep > i ? "done " : pipelineStep === i ? "running " : ""}{step}
              </span>
              {i < PIPELINE_STEPS.length - 1 && <span className="pipeline-bar-arrow">-</span>}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", alignItems: "start" }}>
          <div>
            <div className="section-title">Your Repositories</div>
            {loadingRepos ? <div className="loading-repos">Loading repos...</div> : repos.length === 0 ? <div className="loading-repos">No repos found.</div> : (
              <div className="repos-grid">
                {repos.map(repo => {
                  const isLive = deployStatus[repo.name] === "live";
                  const isDeploying = deployingRepo === repo.name;
                  const liveUrl = deployStatus[repo.name + "_url"] || "";
                  return (
                    <div key={repo.id} className="repo-card">
                      <div className="repo-card-top">
                        <div className="repo-name"><span className="repo-icon">folder </span>{repo.name}</div>
                        {repo.language && <span className="repo-lang">{repo.language}</span>}
                      </div>
                      {repo.description && <p style={{ fontSize: "13px", color: "var(--gray-400)", lineHeight: 1.5 }}>{repo.description}</p>}
                      <div className="repo-updated">Updated {formatDate(repo.updated_at)}</div>
                      {isLive && <div className="deploy-status status-live">Live - deployed successfully</div>}
                      {isLive && liveUrl && <a href={liveUrl} style={{ fontSize: "12px", color: "var(--green)", display: "block", marginBottom: "8px", wordBreak: "break-all" }}>{liveUrl}</a>}
                      {isDeploying && <div className="deploy-status status-running">Deploying...</div>}
                      <button className="deploy-btn" onClick={() => handleDeploy(repo)} disabled={!!deployingRepo}>
                        {isDeploying ? "Deploying..." : isLive ? "Redeploy" : "Deploy"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ position: "sticky", top: "80px" }}>
            <div className="section-title">Live Logs</div>
            <div style={{ background: "#000", border: "1px solid var(--border2)", borderRadius: "12px", padding: "20px", height: "520px", overflowY: "auto", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.8" }}>
              {logs.length === 0 ? <span style={{ color: "var(--gray-600)" }}>Waiting for deployment...</span> : logs.map((log, i) => (
                <div key={i}><span style={{ color: "var(--gray-600)" }}>[{log.time}]</span> <span style={{ color: "#e0e0e0" }}>{log.text}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}