import React from "react";

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
        <h2>{repo}</h2>
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
        <h2>{repo}</h2>
        <div className="no-release">No releases found</div>
      </div>
    );
  }

  return (
    <div className="repo-card-wrap">
      {hasChanges && (
        <div className="badge-container">
          <span className="badge new-changes">New Changes</span>
        </div>
      )}
      <div className={`repo-card ${hasChanges ? "has-changes" : ""}`}>
        <div className="repo-header">
          <h2>
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {repo}
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
    </div>
  );
}

export default RepoCard;
