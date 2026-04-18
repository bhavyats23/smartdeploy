require("dotenv").config();

if (process.env.NODE_ENV === "production") {
  require("./src/server/app");
} else {
  const { spawn } = require("child_process");
  const path = require("path");

  console.log("🚀 Starting SmartDeploy in development mode...");

  const backend = spawn("node", ["src/server/app.js"], {
    stdio: "inherit",
    shell: true,
  });

  const frontend = spawn("npx", ["vite"], {
    stdio: "inherit",
    shell: true,
    cwd: path.join(__dirname),
  });

  backend.on("error", (err) => console.error("Backend error:", err));
  frontend.on("error", (err) => console.error("Frontend error:", err));

  process.on("SIGINT", () => {
    backend.kill("SIGINT");
    frontend.kill("SIGINT");
    process.exit();
  });
}
