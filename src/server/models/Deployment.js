const mongoose = require("mongoose");

const deploymentSchema = new mongoose.Schema({
  repoName: { type: String, required: true },
  repoUrl: { type: String, required: true },
  renderHookUrl: { type: String, default: "" }, // ← new
  renderServiceId: { type: String, default: "" }, // ← new
  status: {
    type: String,
    enum: ["running", "success", "failed"],
    default: "running",
  },
  jenkinsBuildNumber: { type: Number },
  logs: { type: String, default: "" },
  liveUrl: { type: String, default: "" },
  triggeredBy: { type: String, default: "" },
  triggeredAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

module.exports = mongoose.model("Deployment", deploymentSchema);
