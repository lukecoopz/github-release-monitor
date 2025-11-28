import React, { useState, useEffect } from "react";
import "./Login.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

function Login({ onLogin, error: externalError }) {
  const [authConfig, setAuthConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(externalError);

  // Check what auth methods are available
  useEffect(() => {
    const checkAuthConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/check`);
        const data = await response.json();
        setAuthConfig(data);
      } catch (err) {
        console.error("Failed to check auth config:", err);
        // Default to showing OAuth option
        setAuthConfig({ oauthConfigured: true, tokenConfigured: false });
      }
    };
    checkAuthConfig();
  }, []);

  useEffect(() => {
    setError(externalError);
  }, [externalError]);

  const handleGitHubLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/github`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirect to GitHub OAuth
      window.location.href = data.url;
    } catch (err) {
      console.error("Failed to initiate login:", err);
      setError(err.message || "Failed to initiate GitHub login");
      setLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/token-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Token login failed");
      }

      // Store session
      localStorage.setItem("sessionId", data.sessionId);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Call onLogin callback
      onLogin(data.user, data.sessionId);
    } catch (err) {
      console.error("Token login failed:", err);
      setError(err.message || "Token login failed");
      setLoading(false);
    }
  };

  const showOAuthButton = authConfig?.oauthConfigured;
  const showTokenButton = authConfig?.tokenConfigured;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/robot.png" alt="Dashboard Logo" className="login-logo" />
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
              <strong>{authConfig?.allowedOrg || "DroneDeploy"}</strong>{" "}
              employees.
              <br />
              Sign in to continue.
            </p>
          </div>

          {error && (
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* OAuth Login Button */}
          {showOAuthButton && (
            <button
              className="github-login-btn"
              onClick={handleGitHubLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-spinner">Authenticating...</span>
              ) : (
                <>
                  <svg
                    className="github-icon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Sign in with GitHub
                </>
              )}
            </button>
          )}

          {/* Divider when both options available */}
          {showOAuthButton && showTokenButton && (
            <div className="login-divider">
              <span>or</span>
            </div>
          )}

          {/* Token Login Button */}
          {showTokenButton && (
            <button
              className="token-login-btn"
              onClick={handleTokenLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-spinner">Authenticating...</span>
              ) : (
                <>
                  <span className="token-icon">🔑</span>
                  Quick Login (Server Token)
                </>
              )}
            </button>
          )}

          {/* Show message if neither is configured */}
          {authConfig && !showOAuthButton && !showTokenButton && (
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              <span>
                No authentication method configured. Please set up GITHUB_TOKEN
                or GitHub OAuth in server/.env
              </span>
            </div>
          )}

          <div className="login-footer">
            {showTokenButton && !showOAuthButton ? (
              <p>
                Using server token for authentication. For production, configure
                GitHub OAuth.
              </p>
            ) : (
              <p>
                By signing in, you authorize the dashboard to verify your
                organization membership.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
