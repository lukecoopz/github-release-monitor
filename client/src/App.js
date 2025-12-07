import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import Login from "./Login";
import {
  fetchRepositoriesBatch,
  getRateLimit,
  verifyToken,
  verifyOrgMembership,
} from "./services/github";

function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Repository list
  const [repos] = useState([
    { owner: "dronedeploy", repo: "agent-scheduling-configurator" },
    { owner: "dronedeploy", repo: "agent-seti" },
    { owner: "dronedeploy", repo: "agent-test-suite" },
    { owner: "dronedeploy", repo: "alice" },
    { owner: "dronedeploy", repo: "anybotics-protos" },
    { owner: "dronedeploy", repo: "backoff" },
    { owner: "dronedeploy", repo: "boston-dynamics-protos" },
    { owner: "dronedeploy", repo: "button" },
    { owner: "dronedeploy", repo: "chewie" },
    { owner: "dronedeploy", repo: "commando" },
    { owner: "dronedeploy", repo: "connor" },
    { owner: "dronedeploy", repo: "custom-widgets" },
    { owner: "dronedeploy", repo: "daniel" },
    { owner: "dronedeploy", repo: "dash" },
    { owner: "dronedeploy", repo: "dora" },
    { owner: "dronedeploy", repo: "escobar" },
    { owner: "dronedeploy", repo: "eve" },
    { owner: "dronedeploy", repo: "filagree" },
    { owner: "dronedeploy", repo: "gamma" },
    { owner: "dronedeploy", repo: "giraffe" },
    { owner: "dronedeploy", repo: "go-common" },
    { owner: "dronedeploy", repo: "go-common-shared" },
    { owner: "dronedeploy", repo: "import-export-service" },
    { owner: "dronedeploy", repo: "jwks-client" },
    { owner: "dronedeploy", repo: "leica-blk-arc-protos" },
    { owner: "dronedeploy", repo: "minty" },
    { owner: "dronedeploy", repo: "opera" },
    { owner: "dronedeploy", repo: "pamela" },
    { owner: "dronedeploy", repo: "pigeon" },
    { owner: "dronedeploy", repo: "pingu" },
    { owner: "dronedeploy", repo: "potamoi" },
    { owner: "dronedeploy", repo: "proto-go-shared" },
    { owner: "dronedeploy", repo: "raggie" },
    { owner: "dronedeploy", repo: "rambo" },
    { owner: "dronedeploy", repo: "robert" },
    { owner: "dronedeploy", repo: "rocos-agent-plugin-insta360" },
    { owner: "dronedeploy", repo: "rocos-agent-plugin-load-test" },
    { owner: "dronedeploy", repo: "rocos-console" },
    { owner: "dronedeploy", repo: "rocos-go" },
    { owner: "dronedeploy", repo: "rocos-js-sdk" },
    { owner: "dronedeploy", repo: "rocos-node-common" },
    { owner: "dronedeploy", repo: "serviette" },
    { owner: "dronedeploy", repo: "spotty" },
    { owner: "dronedeploy", repo: "spud" },
    { owner: "dronedeploy", repo: "stitch" },
    { owner: "dronedeploy", repo: "stormie" },
    { owner: "dronedeploy", repo: "strimovic" },
    { owner: "dronedeploy", repo: "taggie" },
    { owner: "dronedeploy", repo: "teletubby" },
    { owner: "dronedeploy", repo: "terminator" },
    { owner: "dronedeploy", repo: "tigris" },
    { owner: "dronedeploy", repo: "time-syncer" },
    { owner: "dronedeploy", repo: "venti" },
    { owner: "dronedeploy", repo: "victor" },
  ]);

  const [repoData, setRepoData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiUsage, setApiUsage] = useState(null);
  const [filterNewChanges, setFilterNewChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCriteria, setSortCriteria] = useState([
    { field: "alphabetical", order: "asc" },
  ]);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("github-dashboard-theme");
    return savedTheme || "dark";
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const sessionData = localStorage.getItem("github-dashboard-session");
        if (sessionData) {
          const session = JSON.parse(sessionData);

          // Check if session is expired
          if (session.expiresAt && Date.now() > session.expiresAt) {
            localStorage.removeItem("github-dashboard-session");
            setAuthLoading(false);
            return;
          }

          // Verify token is still valid
          const userData = await verifyToken(session.token);
          const isMember = await verifyOrgMembership(
            session.token,
            userData.login
          );

          if (isMember) {
            setUser(session.user);
            setToken(session.token);
          } else {
            localStorage.removeItem("github-dashboard-session");
          }
        }
      } catch (err) {
        console.error("Session validation failed:", err);
        localStorage.removeItem("github-dashboard-session");
      }
      setAuthLoading(false);
    };

    checkSession();
  }, []);

  // Handle auth success
  const handleAuthSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setAuthError(null);
    setAuthLoading(false);
  };

  // Logout handler
  const handleLogout = useCallback(() => {
    localStorage.removeItem("github-dashboard-session");
    setUser(null);
    setToken(null);
  }, []);

  // Cache key based on repos list
  const cacheKey = `github-dashboard-${repos
    .map((r) => `${r.owner}/${r.repo}`)
    .join(",")}`;

  // Load from localStorage
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        const cacheAge = Date.now() - (data.timestamp || 0);
        if (cacheAge < 24 * 60 * 60 * 1000) {
          console.log("📦 Loading cached data from localStorage");
          return data.repoData;
        }
      }
    } catch (err) {
      console.error("Error loading from localStorage:", err);
    }
    return null;
  }, [cacheKey]);

  // Save to localStorage
  const saveCachedData = useCallback(
    (data) => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            repoData: data,
            timestamp: Date.now(),
          })
        );
        console.log("💾 Saved data to localStorage");
      } catch (err) {
        console.error("Error saving to localStorage:", err);
      }
    },
    [cacheKey]
  );

  // Fetch API usage stats
  const fetchApiUsage = useCallback(async () => {
    if (!token) return;

    try {
      const usage = await getRateLimit(token);
      if (usage) {
        setApiUsage(usage);
      }
    } catch (err) {
      console.error("Failed to fetch API usage:", err);
    }
  }, [token]);

  // Fetch repos
  const fetchRepos = useCallback(
    async (refresh = false) => {
      if (!token) return;

      if (!refresh) {
        const cached = loadCachedData();
        if (cached) {
          setRepoData(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      try {
        console.log("🚀 Fetching repository data from GitHub...");
        const results = await fetchRepositoriesBatch(token, repos);

        setRepoData(results);
        saveCachedData(results);

        // Refresh API usage
        fetchApiUsage();
      } catch (err) {
        console.error("Failed to fetch repos:", err);

        // Check if it's an auth error
        if (
          err.message?.includes("401") ||
          err.message?.includes("Invalid token")
        ) {
          handleLogout();
          return;
        }

        setError("Failed to fetch repository data");

        // Try to use cached data
        const cached = loadCachedData();
        if (cached) {
          console.log("⚠️ API failed, using cached data");
          setRepoData(cached);
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [token, repos, loadCachedData, saveCachedData, fetchApiUsage, handleLogout]
  );

  // Apply theme on mount and when it changes
  useEffect(() => {
    localStorage.setItem("github-dashboard-theme", theme);
    document.body.className = theme === "dark" ? "theme-dark" : "theme-light";
  }, [theme]);

  // Fetch repos when authenticated
  useEffect(() => {
    if (!token) return;

    const cached = loadCachedData();
    if (cached) {
      setRepoData(cached);
      setLoading(false);
    } else {
      fetchRepos(false);
    }

    fetchApiUsage();
    const interval = setInterval(fetchApiUsage, 30000);
    return () => clearInterval(interval);
  }, [token, loadCachedData, fetchRepos, fetchApiUsage]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeSince = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Filter repos
  const filteredRepoData = repoData.filter((data) => {
    if (filterNewChanges && !data.hasChanges) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const repoName = `${data.owner}/${data.repo}`.toLowerCase();

      if (repoName.includes(query)) {
        return true;
      }

      if (data.commits && data.commits.length > 0) {
        const commitMatches = data.commits.some((commit) =>
          commit.message.toLowerCase().includes(query)
        );
        if (commitMatches) {
          return true;
        }
      }

      if (data.prs && data.prs.length > 0) {
        const prMatches = data.prs.some((pr) =>
          pr.title.toLowerCase().includes(query)
        );
        if (prMatches) {
          return true;
        }
      }

      return false;
    }

    return true;
  });

  // Sort helper
  const getSortValue = (data, field) => {
    switch (field) {
      case "commit-date":
        return data.commits && data.commits.length > 0
          ? Math.max(...data.commits.map((c) => new Date(c.date).getTime()))
          : 0;
      case "merge-date":
        return data.prs && data.prs.length > 0
          ? Math.max(...data.prs.map((pr) => new Date(pr.mergedAt).getTime()))
          : 0;
      case "release-date":
        return data.release && data.release.date
          ? new Date(data.release.date).getTime()
          : 0;
      case "alphabetical":
      default:
        return `${data.owner}/${data.repo}`.toLowerCase();
    }
  };

  // Sort repos
  const sortedRepoData = [...filteredRepoData].sort((a, b) => {
    for (const criterion of sortCriteria) {
      const { field, order } = criterion;
      const aValue = getSortValue(a, field);
      const bValue = getSortValue(b, field);

      let comparison = 0;
      if (field === "alphabetical") {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = aValue - bValue;
      }

      if (order === "desc") {
        comparison = -comparison;
      }

      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });

  // Loading state
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner"></div>
        <p>Loading...</p>
        <style>{`
          .auth-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            gap: 20px;
          }
          .auth-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top-color: #60a5fa;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .auth-loading p {
            color: rgba(255, 255, 255, 0.8);
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Login page
  if (!user) {
    return <Login onLogin={handleAuthSuccess} error={authError} />;
  }

  // Main dashboard
  return (
    <div className={`App theme-${theme}`}>
      <header className="App-header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-controls">
              <button
                className={`filter-btn ${filterNewChanges ? "active" : ""}`}
                onClick={() => setFilterNewChanges(!filterNewChanges)}
                title={
                  filterNewChanges
                    ? "Show all repositories"
                    : "Show only repositories with new changes"
                }
              >
                {filterNewChanges
                  ? "🔍 Showing New Changes"
                  : "🔍 Filter New Changes"}
              </button>
              <input
                type="text"
                className="search-input"
                placeholder="Search repos, commits, PRs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                title="Search repositories by name, commit messages, or PR titles"
              />
            </div>
          </div>
          <div className="header-text">
            <h1>
              <img
                src={`${process.env.PUBLIC_URL}/robot.png`}
                alt="Verified Robot"
                style={{
                  width: "64px",
                  height: "64px",
                  verticalAlign: "middle",
                  marginRight: "8px",
                }}
              />
              GitHub Release Dashboard
            </h1>
            <p className="subtitle">
              Monitor release versions and pending changes
            </p>
          </div>
          <div className="header-widget">
            <div className="widget-container">
              {/* User profile */}
              <div className="user-profile">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="user-avatar"
                />
                <span className="user-name">{user.name || user.login}</span>
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                  title="Sign out"
                >
                  Sign out
                </button>
              </div>
              {apiUsage ? (
                <ApiUsageWidget usage={apiUsage} />
              ) : (
                <div className="api-usage-widget">
                  <div className="api-usage-label">API Usage:</div>
                  <div className="api-usage-text">Loading...</div>
                </div>
              )}
              <div className="button-row">
                <button
                  className="refresh-btn"
                  onClick={() => fetchRepos(true)}
                  disabled={loading}
                  title="Refresh data from GitHub"
                >
                  {loading ? "Refreshing..." : "🔄 Refresh"}
                </button>
                <button
                  className="theme-toggle-btn"
                  onClick={toggleTheme}
                  title={`Switch to ${
                    theme === "dark" ? "light" : "dark"
                  } mode`}
                >
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {!loading && !error && filteredRepoData.length > 0 && (
        <div className="sort-controls">
          <span className="sort-label">Sort by:</span>
          {["alphabetical", "commit-date", "merge-date", "release-date"].map(
            (field) => {
              const fieldLabel = {
                alphabetical: "Alphabetical",
                "commit-date": "Commit Date",
                "merge-date": "Merge Date",
                "release-date": "Release Date",
              }[field];

              const sortIndex = sortCriteria.findIndex(
                (c) => c.field === field
              );
              const isActive = sortIndex !== -1;
              const currentOrder = isActive
                ? sortCriteria[sortIndex].order
                : "asc";

              return (
                <button
                  key={field}
                  className={`sort-btn ${isActive ? "active" : ""}`}
                  onClick={() => {
                    if (isActive) {
                      if (currentOrder === "asc") {
                        setSortCriteria(
                          sortCriteria.map((c, idx) =>
                            idx === sortIndex ? { ...c, order: "desc" } : c
                          )
                        );
                      } else {
                        const newCriteria = sortCriteria.filter(
                          (c, idx) => idx !== sortIndex
                        );
                        setSortCriteria(newCriteria);
                      }
                    } else {
                      setSortCriteria([
                        ...sortCriteria,
                        { field, order: "asc" },
                      ]);
                    }
                  }}
                >
                  {fieldLabel}
                  {isActive && (
                    <>
                      <span className="sort-chevron">
                        {currentOrder === "asc" ? "↑" : "↓"}
                      </span>
                      {sortCriteria.length > 1 && (
                        <span className="sort-priority">{sortIndex + 1}</span>
                      )}
                    </>
                  )}
                </button>
              );
            }
          )}
          {sortCriteria.length > 1 && (
            <button
              className="sort-btn sort-clear"
              onClick={() =>
                setSortCriteria([{ field: "alphabetical", order: "asc" }])
              }
              title="Clear all sorts"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="dashboard">
        {loading ? (
          <div className="loading">Loading repository data...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : filteredRepoData.length === 0 ? (
          <div className="no-results">
            {filterNewChanges && searchQuery.trim()
              ? "No repositories with new changes match your search."
              : filterNewChanges
              ? "No repositories with new changes found."
              : searchQuery.trim()
              ? "No repositories match your search."
              : "No repositories found."}
          </div>
        ) : (
          sortedRepoData.map((data, index) => (
            <RepoCard
              key={`${data.owner}-${data.repo}-${index}`}
              data={data}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              getTimeSince={getTimeSince}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RepoCard({ data, formatDate, formatDateTime, getTimeSince }) {
  const {
    owner,
    repo,
    release,
    hasChanges,
    commitsCount,
    prsCount,
    commits,
    prs,
    error,
  } = data;

  if (error) {
    const isRateLimit =
      error.includes("rate limit") || error.includes("Rate limit");
    return (
      <div className="repo-card error-card">
        <h2>
          {owner}/{repo}
        </h2>
        <div className="error-message">
          <div className="error-icon">❌</div>
          <div className="error-text">
            <strong>{error}</strong>
            {isRateLimit && (
              <div className="error-help">
                <p>
                  ⚠️ GitHub API rate limit exceeded. Please wait before
                  refreshing.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="repo-card">
        <h2>
          {owner}/{repo}
        </h2>
        <div className="no-release">No releases found</div>
      </div>
    );
  }

  return (
    <div className={`repo-card ${hasChanges ? "has-changes" : ""}`}>
      <div className="repo-header">
        {hasChanges && (
          <div className="badge-container">
            <span className="badge new-changes">New Changes</span>
          </div>
        )}
        <h2>
          <a
            href={`https://github.com/${owner}/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {owner}/{repo}
          </a>
        </h2>
      </div>

      <div className="release-info">
        <div className="release-version">
          <span className="label">Current Release:</span>
          <a
            href={release.url}
            target="_blank"
            rel="noopener noreferrer"
            className="version-tag"
          >
            {release.tag}
          </a>
        </div>
        <div className="release-date">
          <span className="label">Released:</span>
          <span className="date">{formatDate(release.date)}</span>
          <span className="time-ago">({getTimeSince(release.date)})</span>
        </div>
      </div>

      {hasChanges && (
        <div className="changes-section">
          <div className="changes-summary">
            <div className="change-item">
              <span className="change-icon">📝</span>
              <span className="change-count">{commitsCount} commits</span>
            </div>
            <div className="change-item">
              <span className="change-icon">🔀</span>
              <span className="change-count">{prsCount} PRs merged</span>
            </div>
          </div>

          {prs && prs.length > 0 && (
            <div className="prs-list">
              <h3>Recent Merged PRs:</h3>
              <ul>
                {prs.map((pr) => (
                  <li key={pr.number}>
                    <a href={pr.url} target="_blank" rel="noopener noreferrer">
                      #{pr.number} - {pr.title}
                    </a>
                    <span className="pr-date">
                      {formatDateTime(pr.mergedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {commits && commits.length > 0 && (
            <div className="commits-list">
              <h3>Recent Commits:</h3>
              <ul>
                {commits.slice(0, 5).map((commit, idx) => (
                  <li key={idx}>
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {commit.sha} - {commit.message}
                    </a>
                    <span className="commit-date">
                      {formatDateTime(commit.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!hasChanges && (
        <div className="no-changes">✅ No changes since last release</div>
      )}
    </div>
  );
}

function ApiUsageWidget({ usage }) {
  const { used, limit, remaining, percentage, resetInMinutes } = usage;
  const isWarning = percentage > 80;
  const isCritical = percentage > 90;

  return (
    <div
      className={`api-usage-widget ${
        isCritical ? "critical" : isWarning ? "warning" : ""
      }`}
    >
      <div className="api-usage-label">API Usage:</div>
      <div className="api-usage-bar-container">
        <div className="api-usage-bar" style={{ width: `${percentage}%` }} />
      </div>
      <div className="api-usage-text">
        {used.toLocaleString()} / {limit.toLocaleString()} ({percentage}%)
      </div>
      <div className="api-usage-details">
        {remaining > 0 ? (
          <span>{remaining.toLocaleString()} remaining</span>
        ) : (
          <span className="api-usage-error">Rate limit exceeded!</span>
        )}
        {resetInMinutes > 0 && (
          <span className="api-usage-reset">• Resets in {resetInMinutes}m</span>
        )}
      </div>
    </div>
  );
}

export default App;
