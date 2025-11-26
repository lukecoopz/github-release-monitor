import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

function App() {
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
        // Check if cache is not too old (optional - you can remove this check if you want cache to persist forever)
        const cacheAge = Date.now() - (data.timestamp || 0);
        // Cache is valid for 24 hours (optional safety check)
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
    try {
      const response = await axios.get(`${API_BASE}/api/usage`);
      setApiUsage(response.data);
    } catch (err) {
      console.error("Failed to fetch API usage:", err);
      // Set default/fallback data if API fails
      setApiUsage({
        used: 0,
        limit: 5000,
        remaining: 5000,
        percentage: 0,
        resetInMinutes: 60,
        resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    }
  }, []);

  const fetchRepos = useCallback(
    async (refresh = false) => {
      // If not refreshing, try to load from localStorage first
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
        // Use batch endpoint to fetch all repos in a single request
        const response = await axios.post(`${API_BASE}/api/repos/batch`, {
          repos,
          refresh,
        });

        setRepoData(response.data);
        // Save to localStorage
        saveCachedData(response.data);

        // Update API usage stats immediately after refresh
        // Use setTimeout to ensure it happens after the current execution context
        if (refresh) {
          setTimeout(() => {
            fetchApiUsage();
          }, 200); // 200ms delay to ensure server has processed the counter increment
        }
      } catch (err) {
        setError("Failed to fetch repository data");
        console.error(err);

        // Try to load from cache even if API fails
        const cached = loadCachedData();
        if (cached) {
          console.log("⚠️ API failed, using cached data");
          setRepoData(cached);
          setError(null);
        } else {
          // Fallback: try individual requests if batch fails
          try {
            const fallbackResults = await Promise.all(
              repos.map(({ owner, repo }) =>
                axios
                  .get(`${API_BASE}/api/repo/${owner}/${repo}`, {
                    params: refresh ? { refresh: "true" } : {},
                  })
                  .then((response) => response.data)
                  .catch((err) => ({
                    owner,
                    repo,
                    error: err.response?.data?.message || err.message,
                    statusCode: err.response?.status,
                  }))
              )
            );
            setRepoData(fallbackResults);
            saveCachedData(fallbackResults);
          } catch (fallbackErr) {
            console.error("Fallback also failed:", fallbackErr);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [repos, loadCachedData, saveCachedData, fetchApiUsage]
  );

  useEffect(() => {
    // Load cached data from localStorage on mount (no API calls)
    const cached = loadCachedData();
    if (cached) {
      setRepoData(cached);
      setLoading(false);
    } else {
      // Only fetch if no cache exists
      fetchRepos(false);
    }

    // Fetch API usage stats
    fetchApiUsage();

    // Update API usage every 30 seconds
    const interval = setInterval(fetchApiUsage, 30000);
    return () => clearInterval(interval);
  }, [loadCachedData, fetchRepos, fetchApiUsage]);

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

  // Filter repos based on filterNewChanges and searchQuery
  const filteredRepoData = repoData.filter((data) => {
    // Filter by new changes if enabled
    if (filterNewChanges && !data.hasChanges) {
      return false;
    }

    // Filter by search query (repository name or commit messages)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const repoName = `${data.owner}/${data.repo}`.toLowerCase();

      // Check if repository name matches
      if (repoName.includes(query)) {
        return true;
      }

      // Check if any commit message matches
      if (data.commits && data.commits.length > 0) {
        const commitMatches = data.commits.some((commit) =>
          commit.message.toLowerCase().includes(query)
        );
        if (commitMatches) {
          return true;
        }
      }

      // Check if any PR title matches
      if (data.prs && data.prs.length > 0) {
        const prMatches = data.prs.some((pr) =>
          pr.title.toLowerCase().includes(query)
        );
        if (prMatches) {
          return true;
        }
      }

      // No match found
      return false;
    }

    return true;
  });

  return (
    <div className="App">
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
            <h1>🚀 GitHub Release Dashboard</h1>
            <p className="subtitle">
              Monitor release versions and pending changes
            </p>
          </div>
          <div className="header-widget">
            {apiUsage ? (
              <ApiUsageWidget usage={apiUsage} />
            ) : (
              <div className="api-usage-widget">
                <div className="api-usage-label">API Usage:</div>
                <div className="api-usage-text">Loading...</div>
              </div>
            )}
          </div>
        </div>
      </header>

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
          filteredRepoData.map((data, index) => (
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

      <button
        className="refresh-btn"
        onClick={() => fetchRepos(true)}
        disabled={loading}
        title="Refresh data from GitHub"
      >
        {loading ? "Refreshing..." : "🔄 Refresh"}
      </button>
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
    const is403 = data.statusCode === 403;
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
                  ⚠️ GitHub API rate limit exceeded. Cached data will be
                  displayed until you manually refresh.
                </p>
                <p>
                  Please wait a few minutes before clicking the Refresh button.
                </p>
              </div>
            )}
            {is403 && !isRateLimit && (
              <div className="error-help">
                <p>This repository is private and requires authentication.</p>
                <p>
                  Please set up a GitHub token in <code>server/.env</code>:
                </p>
                <code>GITHUB_TOKEN=your_token_here</code>
                <p>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get a token here →
                  </a>
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
