import React, { useEffect, useState } from "react";
import "./Login.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

function AuthCallback({ onAuthSuccess, onAuthError }) {
  const [status, setStatus] = useState("Processing authentication...");

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const error = urlParams.get("error");
      const errorDescription = urlParams.get("error_description");

      if (error) {
        setStatus(`Authentication failed: ${errorDescription || error}`);
        onAuthError(errorDescription || error);
        return;
      }

      if (!code) {
        setStatus("No authorization code received");
        onAuthError("No authorization code received");
        return;
      }

      try {
        setStatus("Verifying your organization membership...");

        const response = await fetch(`${API_BASE}/api/auth/github/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Authentication failed");
        }

        // Store session
        localStorage.setItem("sessionId", data.sessionId);
        localStorage.setItem("user", JSON.stringify(data.user));

        setStatus("Success! Redirecting...");

        // Clear URL params and redirect
        window.history.replaceState({}, document.title, "/");
        onAuthSuccess(data.user, data.sessionId);
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus(err.message);
        onAuthError(err.message);
      }
    };

    handleCallback();
  }, [onAuthSuccess, onAuthError]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/robot.png" alt="Dashboard Logo" className="login-logo" />
          <h1>GitHub Release Dashboard</h1>
        </div>

        <div className="login-content">
          <div className="auth-status">
            <div className="auth-spinner"></div>
            <p>{status}</p>
          </div>
        </div>
      </div>

      <style>{`
        .auth-status {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 40px 20px;
          text-align: center;
        }

        .auth-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: #60a5fa;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .auth-status p {
          color: rgba(255, 255, 255, 0.8);
          font-size: 1rem;
          margin: 0;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default AuthCallback;
