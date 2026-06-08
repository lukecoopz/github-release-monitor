import React, { useState } from "react";
import "./Login.css";
import { verifyToken, verifyOrgMembership, CONFIG } from "./services/github";

function Login({ onLogin, error: externalError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(externalError);
  const [userToken, setUserToken] = useState("");

  // Login using user's GitHub token
  const handleTokenLogin = async () => {
    if (!userToken.trim()) {
      setError("Please enter your GitHub Personal Access Token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify the token and get user info
      const user = await verifyToken(userToken.trim());

      // Verify organization membership
      const isMember = await verifyOrgMembership(userToken.trim(), user.login);

      if (!isMember) {
        throw new Error(
          `Access denied. You must be a member of the ${CONFIG.allowedOrg} organization.`
        );
      }

      // Create session data
      const sessionData = {
        user: {
          id: user.id,
          login: user.login,
          name: user.name || user.login,
          avatar_url: user.avatar_url,
        },
        token: userToken.trim(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      // Store in localStorage
      localStorage.setItem(
        "github-dashboard-session",
        JSON.stringify(sessionData)
      );

      // Clear token from state
      setUserToken("");

      // Notify parent
      onLogin(sessionData.user, sessionData.token);
    } catch (err) {
      console.error("Login failed:", err);
      setError(err.message || "Login failed. Please check your token.");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src={`${process.env.PUBLIC_URL}/robot.png`}
            alt="Dashboard Logo"
            className="login-logo"
          />
          <h1>GitHub Release Dashboard</h1>
          <p className="login-subtitle">
            Monitor release versions and pending changes
          </p>
        </div>

        <div className="login-content">
          <div className="login-info">
            <div className="info-icon">🔒</div>
            <p>
              This dashboard is restricted to{" "}
              <strong>{CONFIG.allowedOrg}</strong> employees.
              <br />
              Sign in with your GitHub Personal Access Token.
            </p>
          </div>

          {error && (
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Token Input Section */}
          <div className="token-input-section">
            <div className="token-input-header">
              <span>🔑 GitHub Personal Access Token</span>
            </div>
            <input
              type="password"
              className="token-input"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={userToken}
              onChange={(e) => setUserToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTokenLogin()}
              disabled={loading}
              autoFocus
            />
            <button
              className="github-login-btn"
              onClick={handleTokenLogin}
              disabled={loading || !userToken.trim()}
            >
              {loading ? (
                <span className="loading-spinner">Verifying...</span>
              ) : (
                <>
                  <svg
                    className="github-icon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Verify & Login
                </>
              )}
            </button>
            <p className="token-help">
              <strong>Create a token:</strong>{" "}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=Release%20Dashboard"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/settings/tokens
              </a>
              <br />
              Required scopes: <code>repo</code>, <code>read:org</code>
            </p>
          </div>

          <div className="login-footer">
            <p>
              Your token is verified locally and used to make GitHub API calls.
              <br />
              It's stored in your browser only and never sent to any server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
