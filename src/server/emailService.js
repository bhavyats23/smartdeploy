const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendDeploymentEmail(repoName, status, logs) {
  const isSuccess = status === "success";

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: isSuccess
      ? `✅ SmartDeploy — ${repoName} deployed successfully!`
      : `❌ SmartDeploy — ${repoName} deployment failed!`,
    html: `
      <div style="background:#080808;color:#ffffff;padding:30px;font-family:monospace;">
        <h2 style="color:#00ff88;">SmartDeploy Notification</h2>
        <p style="font-size:18px;">
          ${isSuccess ? "✅ Deployment <b>succeeded</b>" : "❌ Deployment <b>failed</b>"}
        </p>
        <p><b>Repository:</b> ${repoName}</p>
        <p><b>Status:</b> <span style="color:${isSuccess ? "#00ff88" : "#ff4444"}">${status.toUpperCase()}</span></p>
        <hr style="border-color:#00ff88;" />
        <h3 style="color:#00ff88;">Pipeline Logs:</h3>
        <pre style="background:#111;padding:15px;color:#00ff88;overflow:auto;">${logs || "No logs available"}</pre>
        <hr style="border-color:#00ff88;" />
        <p style="color:#555;font-size:12px;">Sent by SmartDeploy CI/CD Platform</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Email sent for ${repoName} — ${status}`);
}

module.exports = { sendDeploymentEmail };
