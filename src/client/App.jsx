import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking

  useEffect(() => {
    fetch("/auth/user", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        // If we got a user object with an id, they're logged in
        if (data && data.id) {
          setUser(data);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, []);

  // Still checking auth — show a dark loading screen
  if (user === undefined) {
    return (
      <div style={loadingStyle}>
        <span style={dotStyle}>⬡</span>
        <span style={textStyle}>SmartDeploy</span>
      </div>
    );
  }

  // Not logged in — show login page
  if (user === null) {
    return <LoginPage />;
  }

  // Logged in — show dashboard
  return <Dashboard user={user} />;
}

const loadingStyle = {
  minHeight: "100vh",
  background: "#080808",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  fontFamily: "'Space Mono', monospace",
};

const dotStyle = {
  fontSize: "28px",
  color: "#00ff88",
};

const textStyle = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#fff",
  fontFamily: "'Syne', sans-serif",
};
