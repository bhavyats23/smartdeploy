// This is the main entry point that runs both frontend and backend
if (process.env.NODE_ENV === "production") {
  // In production, just run the server (which serves the built frontend)
  require("./src/server/app");
} else {
  // In development, use concurrently to run both
  const { spawn } = require("child_process");
  const path = require("path");

  console.log("Starting development environment...");

  // Start the backend server
  const backend = spawn("node", ["src/server/app.js"], {
    stdio: "inherit",
    shell: true,
  });

  // Start the frontend dev server
  const frontend = spawn("npm", ["run", "dev:client"], {
    stdio: "inherit",
    shell: true,
    cwd: path.join(__dirname),
  });

  // Handle process termination
  process.on("SIGINT", () => {
    backend.kill("SIGINT");
    frontend.kill("SIGINT");
    process.exit();
  });
}
