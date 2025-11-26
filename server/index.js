const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// GitHub API base URL
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

// Cache configuration - no expiration, only cleared on manual refresh
const cache = new Map();

// Cache helper functions
function getCacheKey(owner, repo) {
  return `${owner}/${repo}`;
}

function getCachedData(owner, repo) {
  const key = getCacheKey(owner, repo);
  const cached = cache.get(key);

  if (cached) {
    return cached.data;
  }

  return null;
}

function setCachedData(owner, repo, data) {
  const key = getCacheKey(owner, repo);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// Helper function to get GitHub API headers
const getGitHubHeaders = () => {
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };

  // Add token if available (increases rate limit and allows access to private repos)
  if (process.env.GITHUB_TOKEN) {
    const token = process.env.GITHUB_TOKEN.trim();
    // Support both "token" and "Bearer" formats (newer tokens use Bearer)
    if (token.startsWith("ghp_") || token.startsWith("github_pat_")) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      headers["Authorization"] = `token ${token}`;
    }
  }

  return headers;
};

// Helper function to get GitHub GraphQL headers
const getGraphQLHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (process.env.GITHUB_TOKEN) {
    const token = process.env.GITHUB_TOKEN.trim();
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

// Fetch latest release tag and date
async function getLatestRelease(owner, repo) {
  try {
    trackGitHubAPICall(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`
    );
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`,
      { headers: getGitHubHeaders() }
    );

    return {
      tag: response.data.tag_name,
      date: response.data.published_at || response.data.created_at,
      name: response.data.name,
      url: response.data.html_url,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      // No releases found, try to get latest tag instead
      return getLatestTag(owner, repo);
    }
    throw error;
  }
}

// Fallback: Get latest tag if no releases exist
async function getLatestTag(owner, repo) {
  try {
    trackGitHubAPICall(`${GITHUB_API_BASE}/repos/${owner}/${repo}/tags`);
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/tags`,
      { headers: getGitHubHeaders() }
    );

    if (response.data.length === 0) {
      return null;
    }

    // Get the tag details to find the commit date
    const latestTag = response.data[0];
    trackGitHubAPICall(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/tags/${latestTag.name}`
    );
    const tagResponse = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/tags/${latestTag.name}`,
      { headers: getGitHubHeaders() }
    );

    // Get commit details for the tag
    const commitSha = tagResponse.data.object.sha;
    trackGitHubAPICall(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${commitSha}`
    );
    const commitResponse = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${commitSha}`,
      { headers: getGitHubHeaders() }
    );

    return {
      tag: latestTag.name,
      date: commitResponse.data.committer.date,
      name: latestTag.name,
      url: `https://github.com/${owner}/${repo}/releases/tag/${latestTag.name}`,
    };
  } catch (error) {
    throw error;
  }
}

// Get commits merged after a specific tag/date
async function getCommitsSinceRelease(owner, repo, sinceDate) {
  try {
    trackGitHubAPICall(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`);
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`,
      {
        headers: getGitHubHeaders(),
        params: {
          since: sinceDate,
          per_page: 100,
        },
      }
    );

    return response.data.map((commit) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split("\n")[0], // First line only
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
    }));
  } catch (error) {
    throw error;
  }
}

// Get merged PRs since a specific date
async function getMergedPRsSinceRelease(owner, repo, sinceDate) {
  try {
    trackGitHubAPICall(`${GITHUB_API_BASE}/search/issues`);
    const response = await axios.get(`${GITHUB_API_BASE}/search/issues`, {
      headers: getGitHubHeaders(),
      params: {
        q: `repo:${owner}/${repo} is:pr is:merged merged:>${
          sinceDate.split("T")[0]
        }`,
        per_page: 100,
        sort: "updated",
        order: "desc",
      },
    });

    return response.data.items.map((pr) => ({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.pull_request.merged_at,
      author: pr.user.login,
      url: pr.html_url,
    }));
  } catch (error) {
    throw error;
  }
}

// Main endpoint to get repository release info
app.get("/api/repo/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;
  const { refresh } = req.query;

  // Check cache first (unless refresh is requested)
  if (!refresh) {
    const cached = getCachedData(owner, repo);
    if (cached) {
      console.log(`📦 Serving cached data for ${owner}/${repo}`);
      return res.json(cached);
    }
  }

  try {
    // Get latest release
    const release = await getLatestRelease(owner, repo);

    if (!release) {
      const result = {
        owner,
        repo,
        release: null,
        hasChanges: false,
        commits: [],
        prs: [],
        error: "No releases or tags found",
      };
      setCachedData(owner, repo, result);
      return res.json(result);
    }

    // Get commits and PRs since release
    const [commits, prs] = await Promise.all([
      getCommitsSinceRelease(owner, repo, release.date),
      getMergedPRsSinceRelease(owner, repo, release.date),
    ]);

    const result = {
      owner,
      repo,
      release: {
        tag: release.tag,
        date: release.date,
        name: release.name,
        url: release.url,
      },
      hasChanges: commits.length > 0 || prs.length > 0,
      commitsCount: commits.length,
      prsCount: prs.length,
      commits: commits.slice(0, 10), // Limit to 10 most recent
      prs: prs.slice(0, 10), // Limit to 10 most recent
    };

    // Cache the result
    setCachedData(owner, repo, result);
    console.log(`✅ Fetched and cached data for ${owner}/${repo}`);

    res.json(result);
  } catch (error) {
    const statusCode = error.response?.status;
    const errorMessage = error.response?.data?.message || error.message;

    console.error(`Error fetching data for ${owner}/${repo}:`, errorMessage);

    // Provide more helpful error messages
    let userMessage = "Failed to fetch repository data";
    if (statusCode === 403) {
      userMessage =
        "Access forbidden. Please check your GitHub token has access to this private repository.";
    } else if (statusCode === 404) {
      userMessage =
        "Repository not found. Please check the owner and repository name.";
    } else if (statusCode === 401) {
      userMessage =
        "Authentication failed. Please check your GitHub token is valid.";
    } else if (statusCode === 403 && errorMessage.includes("rate limit")) {
      userMessage =
        "GitHub API rate limit exceeded. Data will be served from cache if available.";
      // Try to serve cached data when rate limited
      const cached = getCachedData(owner, repo);
      if (cached) {
        console.log(
          `⚠️ Rate limited - serving cached data for ${owner}/${repo}`
        );
        return res.json(cached);
      }
    }

    res.status(statusCode || 500).json({
      owner,
      repo,
      error: userMessage,
      message: errorMessage,
      statusCode: statusCode,
    });
  }
});

// Batch endpoint using GraphQL to fetch all repos efficiently
app.post("/api/repos/batch", async (req, res) => {
  const { repos, refresh } = req.body; // Array of {owner, repo} objects

  if (!Array.isArray(repos)) {
    return res.status(400).json({ error: "repos must be an array" });
  }

  // Check cache for all repos first (unless refresh is requested)
  if (!refresh) {
    // Check if we have cached data for all repos
    const allCached = repos.every(({ owner, repo }) =>
      getCachedData(owner, repo)
    );
    if (allCached) {
      const cachedResults = repos.map(({ owner, repo }) =>
        getCachedData(owner, repo)
      );
      console.log("📦 Serving cached batch data");
      return res.json(cachedResults);
    }
  }

  try {
    // Process repos in smaller batches to avoid GraphQL query timeout
    // GitHub GraphQL API has limits on query complexity and size
    const BATCH_SIZE = 10; // Process 10 repos at a time
    const COMMITS_PER_REPO = 30; // Reduced from 100 to avoid timeout
    const PRS_PER_REPO = 30; // Reduced from 100 to avoid timeout

    const allResults = [];

    // Process repos in batches
    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      const batch = repos.slice(i, i + BATCH_SIZE);
      console.log(
        `📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${
          batch.length
        } repos)...`
      );

      // Build GraphQL query for this batch
      const repoQueries = batch
        .map((repo, index) => {
          const alias = `repo${index}`;
          return `
          ${alias}: repository(owner: "${repo.owner}", name: "${repo.repo}") {
            name
            owner {
              login
            }
            latestRelease {
              tagName
              publishedAt
              createdAt
              name
              url
            }
            refs(refPrefix: "refs/tags/", first: 1, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
              nodes {
                name
                target {
                  ... on Tag {
                    tagger {
                      date
                    }
                  }
                  ... on Commit {
                    committedDate
                  }
                }
              }
            }
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: ${COMMITS_PER_REPO}) {
                    nodes {
                      oid
                      message
                      committedDate
                      author {
                        name
                      }
                      url
                    }
                  }
                }
              }
            }
            pullRequests(states: MERGED, first: ${PRS_PER_REPO}, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes {
                number
                title
                mergedAt
                author {
                  login
                }
                url
              }
            }
          }
        `;
        })
        .join("\n");

      const graphqlQuery = `
        query {
          ${repoQueries}
        }
      `;

      // Fetch this batch using GraphQL
      trackGitHubAPICall(GITHUB_GRAPHQL_URL);
      const graphqlResponse = await axios.post(
        GITHUB_GRAPHQL_URL,
        { query: graphqlQuery },
        { headers: getGraphQLHeaders() }
      );

      if (graphqlResponse.data.errors) {
        console.error(
          `GraphQL errors in batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          graphqlResponse.data.errors
        );
        // Add error results for this batch
        batch.forEach((repo) => {
          allResults.push({
            owner: repo.owner,
            repo: repo.repo,
            error:
              graphqlResponse.data.errors[0]?.message || "GraphQL query error",
            statusCode: 500,
          });
        });
        continue; // Skip to next batch
      }

      // Check if data exists
      if (!graphqlResponse.data.data) {
        console.error(
          `No data in GraphQL response for batch ${
            Math.floor(i / BATCH_SIZE) + 1
          }`
        );
        batch.forEach((repo) => {
          allResults.push({
            owner: repo.owner,
            repo: repo.repo,
            error: "No data returned from GraphQL query",
            statusCode: 500,
          });
        });
        continue; // Skip to next batch
      }

      // Process GraphQL results for this batch
      const batchResults = batch.map((repo, index) => {
        const alias = `repo${index}`;
        const repoData = graphqlResponse.data.data[alias];

        if (!repoData) {
          return {
            owner: repo.owner,
            repo: repo.repo,
            error: "Repository not found or access denied",
          };
        }

        // Determine latest release or tag
        let release = null;
        if (repoData.latestRelease) {
          release = {
            tag: repoData.latestRelease.tagName,
            date:
              repoData.latestRelease.publishedAt ||
              repoData.latestRelease.createdAt,
            name: repoData.latestRelease.name,
            url: repoData.latestRelease.url,
          };
        } else if (repoData.refs?.nodes?.length > 0) {
          const tag = repoData.refs.nodes[0];
          const date = tag.target.tagger?.date || tag.target.committedDate;
          release = {
            tag: tag.name,
            date: date,
            name: tag.name,
            url: `https://github.com/${repo.owner}/${repo.repo}/releases/tag/${tag.name}`,
          };
        }

        if (!release) {
          const result = {
            owner: repo.owner,
            repo: repo.repo,
            release: null,
            hasChanges: false,
            commits: [],
            prs: [],
            error: "No releases or tags found",
          };
          setCachedData(repo.owner, repo.repo, result);
          return result;
        }

        // Extract and filter commits by release date
        const releaseDate = new Date(release.date);
        const commits = (
          repoData.defaultBranchRef?.target?.history?.nodes || []
        )
          .filter((commit) => new Date(commit.committedDate) > releaseDate)
          .map((commit) => ({
            sha: commit.oid ? commit.oid.substring(0, 7) : "unknown",
            message: commit.message
              ? commit.message.split("\n")[0]
              : "No message",
            author: commit.author?.name || "Unknown",
            date: commit.committedDate,
            url:
              commit.url ||
              `https://github.com/${repo.owner}/${repo.repo}/commit/${commit.oid}`,
          }));

        // Filter PRs by merged date
        const prs = (repoData.pullRequests?.nodes || [])
          .filter((pr) => {
            if (!pr.mergedAt) return false;
            return new Date(pr.mergedAt) > releaseDate;
          })
          .map((pr) => ({
            number: pr.number,
            title: pr.title,
            mergedAt: pr.mergedAt,
            author: pr.author?.login || "Unknown",
            url: pr.url,
          }));

        const result = {
          owner: repo.owner,
          repo: repo.repo,
          release: {
            tag: release.tag,
            date: release.date,
            name: release.name,
            url: release.url,
          },
          hasChanges: commits.length > 0 || prs.length > 0,
          commitsCount: commits.length,
          prsCount: prs.length,
          commits: commits.slice(0, 10),
          prs: prs.slice(0, 10),
        };

        setCachedData(repo.owner, repo.repo, result);
        return result;
      });

      // Add batch results to all results
      allResults.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < repos.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Cache individual repo results
    allResults.forEach((result) => {
      if (result.owner && result.repo && !result.error) {
        setCachedData(result.owner, result.repo, result);
      }
    });

    console.log(
      `✅ Fetched and cached batch data for ${
        repos.length
      } repositories (${Math.ceil(repos.length / BATCH_SIZE)} batches)`
    );
    res.json(allResults);
  } catch (error) {
    const statusCode = error.response?.status;
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0]?.message ||
      error.message;

    console.error("Error in batch fetch:", errorMessage);

    // Try to serve individual cached data if batch fails
    const fallbackResults = repos.map(({ owner, repo }) => {
      const cached = getCachedData(owner, repo);
      if (cached) {
        return cached;
      }
      return {
        owner,
        repo,
        error: errorMessage.includes("rate limit")
          ? "GitHub API rate limit exceeded"
          : "Failed to fetch repository data",
        statusCode,
      };
    });

    res.status(statusCode || 500).json(fallbackResults);
  }
});

// Endpoint to get multiple repositories (legacy - uses individual calls)
app.post("/api/repos", async (req, res) => {
  const { repos } = req.body; // Array of {owner, repo} objects

  if (!Array.isArray(repos)) {
    return res.status(400).json({ error: "repos must be an array" });
  }

  try {
    const results = await Promise.all(
      repos.map(({ owner, repo }) =>
        axios
          .get(`http://localhost:${PORT}/api/repo/${owner}/${repo}`)
          .then((response) => response.data)
          .catch((error) => ({
            owner,
            repo,
            error: error.response?.data?.message || error.message,
          }))
      )
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch repositories data" });
  }
});

// Rate limit tracking
let apiCallCount = 0;
let rateLimitResetTime = Date.now() + 60 * 60 * 1000; // 1 hour from now

function trackGitHubAPICall(url) {
  if (url && (url.includes("api.github.com") || url.includes("github.com"))) {
    apiCallCount++;
    const now = Date.now();
    if (now > rateLimitResetTime) {
      // Reset counter if an hour has passed
      apiCallCount = 1;
      rateLimitResetTime = now + 60 * 60 * 1000;
      console.log(`🔄 Rate limit counter reset`);
    }

    if (apiCallCount % 50 === 0 || apiCallCount > 4500) {
      const remaining = 5000 - apiCallCount;
      console.log(
        `📊 GitHub API calls this hour: ${apiCallCount}/5000 (${remaining} remaining)`
      );
      if (apiCallCount > 4500) {
        console.warn(
          `⚠️ WARNING: Approaching rate limit! Only ${remaining} requests remaining.`
        );
      }
    }

    return apiCallCount;
  }
  return 0;
}

// Endpoint to get API usage stats
app.get("/api/usage", (req, res) => {
  const now = Date.now();
  const remaining = Math.max(0, 5000 - apiCallCount);
  const timeUntilReset = Math.max(0, rateLimitResetTime - now);
  const minutesUntilReset = Math.floor(timeUntilReset / (60 * 1000));

  res.json({
    used: apiCallCount,
    limit: 5000,
    remaining: remaining,
    percentage: Math.round((apiCallCount / 5000) * 100),
    resetInMinutes: minutesUntilReset,
    resetAt: new Date(rateLimitResetTime).toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard API ready`);
  console.log(`📈 API rate limit tracking enabled (5000 requests/hour)`);
});
