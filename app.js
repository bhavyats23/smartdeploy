require("dotenv").config();

if (process.env.NODE_ENV === "production") {
  require("./src/server/app");
} else {
  const { spawn } = require("child_process");
  const path = require("path");

  console.log("Starting development environment...");

  const backend = spawn("node", ["src/server/app.js"], {
    stdio: "inherit",
    shell: true,
  });

  const frontend = spawn("npx", ["vite"], {
    stdio: "inherit",
    shell: true,
    cwd: path.join(__dirname),
  });

  process.on("SIGINT", () => {
    backend.kill("SIGINT");
    frontend.kill("SIGINT");
    process.exit();
  });
}