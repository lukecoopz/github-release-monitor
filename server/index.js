const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// GitHub OAuth Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const ALLOWED_ORG = process.env.ALLOWED_ORG || "dronedeploy";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// In-memory session store (use Redis in production)
const sessions = new Map();

// Session helper functions
function createSession(userData) {
  const sessionId = require("crypto").randomBytes(32).toString("hex");
  sessions.set(sessionId, {
    user: userData,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  return sessionId;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

// CORS configuration - allow credentials
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

// Auth middleware
function requireAuth(req, res, next) {
  const sessionId = req.headers.authorization?.replace("Bearer ", "");

  if (!sessionId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: "Session expired or invalid" });
  }

  req.user = session.user;
  next();
}

// GitHub API base URL
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

// ==========================================
// Authentication Endpoints
// ==========================================

// Check if dev/token auth is available
app.get("/api/auth/check", (req, res) => {
  const hasOAuth = !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
  const hasToken = !!process.env.GITHUB_TOKEN;

  res.json({
    oauthConfigured: hasOAuth,
    tokenConfigured: hasToken,
    allowedOrg: ALLOWED_ORG,
  });
});

// Get GitHub OAuth URL
app.get("/api/auth/github", (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({
      error:
        "GitHub OAuth not configured. Please set GITHUB_CLIENT_ID in server/.env",
    });
  }

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${CLIENT_URL}/auth/callback`,
    scope: "read:org user:email",
    state: require("crypto").randomBytes(16).toString("hex"),
  });

  res.json({
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
  });
});

// Dev/Token-based login - uses server's GITHUB_TOKEN to verify org access
// Restricted to specific user(s) for security
const ALLOWED_TOKEN_USERS = (process.env.ALLOWED_TOKEN_USERS || "lukecoopz")
  .split(",")
  .map((u) => u.trim().toLowerCase());

app.post("/api/auth/token-login", async (req, res) => {
  const serverToken = process.env.GITHUB_TOKEN;

  if (!serverToken) {
    return res.status(500).json({
      error:
        "Server GITHUB_TOKEN not configured. Please set GITHUB_TOKEN in server/.env",
    });
  }

  try {
    // First, get the user associated with the token
    const userResponse = await axios.get(`${GITHUB_API_BASE}/user`, {
      headers: { Authorization: `Bearer ${serverToken.trim()}` },
    });

    const user = userResponse.data;
    console.log(`🔑 Token login attempt for user: ${user.login}`);

    // Check if this user is allowed to use token login
    if (!ALLOWED_TOKEN_USERS.includes(user.login.toLowerCase())) {
      console.log(
        `❌ Token login denied for ${user.login} - not in allowed users list`
      );
      return res.status(403).json({
        error: `Token login is restricted. User "${user.login}" is not authorized for token-based login.`,
      });
    }

    // Check if this token can access a private repo in the org
    // This verifies the token has org access
    try {
      const orgReposResponse = await axios.get(
        `${GITHUB_API_BASE}/orgs/${ALLOWED_ORG}/repos`,
        {
          headers: { Authorization: `Bearer ${serverToken.trim()}` },
          params: { type: "private", per_page: 1 },
        }
      );

      // If we can see private repos, the token has org access
      if (orgReposResponse.status === 200) {
        console.log(`✅ Token has access to ${ALLOWED_ORG} private repos`);
      }
    } catch (orgError) {
      // Try checking org membership as fallback
      try {
        const orgsResponse = await axios.get(`${GITHUB_API_BASE}/user/orgs`, {
          headers: { Authorization: `Bearer ${serverToken.trim()}` },
        });

        const isMember = orgsResponse.data.some(
          (org) => org.login.toLowerCase() === ALLOWED_ORG.toLowerCase()
        );

        if (!isMember) {
          return res.status(403).json({
            error: `Token does not have access to ${ALLOWED_ORG} organization. Please use a token with org access.`,
          });
        }
      } catch (memberError) {
        return res.status(403).json({
          error: `Unable to verify organization access. Token may not have sufficient permissions.`,
        });
      }
    }

    // Create session using the server token
    const userData = {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      accessToken: serverToken.trim(), // Use server token for API calls
      isTokenAuth: true, // Mark as token-based auth
    };

    const sessionId = createSession(userData);

    console.log(`✅ Token login successful for ${user.login}`);

    res.json({
      sessionId,
      user: {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
        isTokenAuth: true,
      },
    });
  } catch (error) {
    console.error("Token login error:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Invalid GITHUB_TOKEN. Please check the token is valid.",
      });
    }

    res.status(500).json({
      error: "Token authentication failed. Please check server logs.",
    });
  }
});

// User-provided token login - user enters their own GitHub PAT
app.post("/api/auth/user-token-login", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: "GitHub Personal Access Token is required",
    });
  }

  const userToken = token.trim();

  try {
    // Get user info from the provided token
    const userResponse = await axios.get(`${GITHUB_API_BASE}/user`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const user = userResponse.data;
    console.log(`🔑 User token login attempt for: ${user.login}`);

    // Verify organization membership
    let isMember = false;

    // Try to check org membership directly
    try {
      const orgResponse = await axios.get(
        `${GITHUB_API_BASE}/orgs/${ALLOWED_ORG}/members/${user.login}`,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      isMember = orgResponse.status === 204;
    } catch (orgError) {
      // If direct check fails, try listing user's orgs
      if (orgError.response?.status === 404 || orgError.response?.status === 403) {
        try {
          const orgsResponse = await axios.get(`${GITHUB_API_BASE}/user/orgs`, {
            headers: { Authorization: `Bearer ${userToken}` },
          });
          isMember = orgsResponse.data.some(
            (org) => org.login.toLowerCase() === ALLOWED_ORG.toLowerCase()
          );
        } catch (listError) {
          console.error("Error listing orgs:", listError.message);
        }
      }
    }

    // Also try to access a private repo as final verification
    if (!isMember) {
      try {
        const reposResponse = await axios.get(
          `${GITHUB_API_BASE}/orgs/${ALLOWED_ORG}/repos`,
          {
            headers: { Authorization: `Bearer ${userToken}` },
            params: { type: "private", per_page: 1 },
          }
        );
        if (reposResponse.status === 200 && reposResponse.data.length > 0) {
          isMember = true;
        }
      } catch (repoError) {
        // If we can't access repos, user is not a member or token lacks permissions
      }
    }

    if (!isMember) {
      console.log(`❌ User ${user.login} is not a member of ${ALLOWED_ORG}`);
      return res.status(403).json({
        error: `Access denied. You must be a member of the ${ALLOWED_ORG} organization.`,
      });
    }

    // Create session with user's token
    const userData = {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      accessToken: userToken, // Use their token for API calls
      isUserToken: true,
    };

    const sessionId = createSession(userData);

    console.log(`✅ User token login successful for ${user.login}`);

    res.json({
      sessionId,
      user: {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("User token login error:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Invalid token. Please check your Personal Access Token is valid and not expired.",
      });
    }

    if (error.response?.status === 403) {
      return res.status(403).json({
        error: "Token lacks required permissions. Please ensure it has 'repo' and 'read:org' scopes.",
      });
    }

    res.status(500).json({
      error: "Authentication failed. Please check your token and try again.",
    });
  }
});

// GitHub OAuth callback - exchange code for token
app.post("/api/auth/github/callback", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Authorization code required" });
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(500).json({
      error:
        "GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in server/.env",
    });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const { access_token, error, error_description } = tokenResponse.data;

    if (error) {
      console.error("OAuth error:", error, error_description);
      return res.status(400).json({ error: error_description || error });
    }

    if (!access_token) {
      return res.status(400).json({ error: "Failed to get access token" });
    }

    // Get user info
    const userResponse = await axios.get(`${GITHUB_API_BASE}/user`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = userResponse.data;

    // Check organization membership
    try {
      const orgResponse = await axios.get(
        `${GITHUB_API_BASE}/orgs/${ALLOWED_ORG}/members/${user.login}`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      // 204 means user is a member
      if (orgResponse.status !== 204) {
        return res.status(403).json({
          error: `Access denied. You must be a member of the ${ALLOWED_ORG} organization.`,
        });
      }
    } catch (orgError) {
      if (orgError.response?.status === 404) {
        return res.status(403).json({
          error: `Access denied. You must be a member of the ${ALLOWED_ORG} organization.`,
        });
      }
      // If we can't check org membership (e.g., private org), try alternative method
      try {
        const orgsResponse = await axios.get(`${GITHUB_API_BASE}/user/orgs`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        const isMember = orgsResponse.data.some(
          (org) => org.login.toLowerCase() === ALLOWED_ORG.toLowerCase()
        );

        if (!isMember) {
          return res.status(403).json({
            error: `Access denied. You must be a member of the ${ALLOWED_ORG} organization.`,
          });
        }
      } catch (altError) {
        console.error("Error checking org membership:", altError.message);
        return res.status(403).json({
          error: `Unable to verify organization membership. Please ensure you're a member of ${ALLOWED_ORG}.`,
        });
      }
    }

    // Create session
    const userData = {
      id: user.id,
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
      accessToken: access_token,
    };

    const sessionId = createSession(userData);

    console.log(`✅ User ${user.login} authenticated successfully`);

    res.json({
      sessionId,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("Auth error:", error.response?.data || error.message);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Check current session
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      login: req.user.login,
      name: req.user.name,
      avatar_url: req.user.avatar_url,
    },
  });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  const sessionId = req.headers.authorization?.replace("Bearer ", "");
  if (sessionId) {
    deleteSession(sessionId);
  }
  res.json({ success: true });
});

// ==========================================
// Cache configuration
// ==========================================
const cache = new Map();

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

// Helper function to get GitHub API headers (uses user's token if available)
const getGitHubHeaders = (userToken) => {
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };

  // Use user's token if available, otherwise fall back to server token
  const token = userToken || process.env.GITHUB_TOKEN;

  if (token) {
    const cleanToken = token.trim();
    if (cleanToken.startsWith("ghp_") || cleanToken.startsWith("github_pat_")) {
      headers["Authorization"] = `Bearer ${cleanToken}`;
    } else {
      headers["Authorization"] = `token ${cleanToken}`;
    }
  }

  return headers;
};

// Helper function to get GitHub GraphQL headers
const getGraphQLHeaders = (userToken) => {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = userToken || process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }

  return headers;
};

// ==========================================
// Protected API Endpoints
// ==========================================

// Fetch latest release tag and date
async function getLatestRelease(owner, repo, userToken) {
  try {
    trackGitHubAPICall(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`
    );
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`,
      { headers: getGitHubHeaders(userToken) }
    );

    return {
      tag: response.data.tag_name,
      date: response.data.published_at || response.data.created_at,
      name: response.data.name,
      url: response.data.html_url,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return getLatestTag(owner, repo, userToken);
    }
    throw error;
  }
}

// Fallback: Get latest tag if no releases exist
async function getLatestTag(owner, repo, userToken) {
  try {
    trackGitHubAPICall(`${GITHUB_API_BASE}/repos/${owner}/${repo}/tags`);
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/tags`,
      { headers: getGitHubHeaders(userToken) }
    );

    if (response.data.length === 0) {
      return null;
    }

    const latestTag = response.data[0];
    trackGitHubAPICall(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/tags/${latestTag.name}`
    );
    const tagResponse = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/tags/${latestTag.name}`,
      { headers: getGitHubHeaders(userToken) }
    );

    const commitSha = tagResponse.data.object.sha;
    trackGitHubAPICall(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${commitSha}`
    );
    const commitResponse = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${commitSha}`,
      { headers: getGitHubHeaders(userToken) }
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
async function getCommitsSinceRelease(owner, repo, sinceDate, userToken) {
  try {
    trackGitHubAPICall(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`);
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`,
      {
        headers: getGitHubHeaders(userToken),
        params: {
          since: sinceDate,
          per_page: 100,
        },
      }
    );

    return response.data.map((commit) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split("\n")[0],
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
    }));
  } catch (error) {
    throw error;
  }
}

// Get merged PRs since a specific date
async function getMergedPRsSinceRelease(owner, repo, sinceDate, userToken) {
  try {
    trackGitHubAPICall(`${GITHUB_API_BASE}/search/issues`);
    const response = await axios.get(`${GITHUB_API_BASE}/search/issues`, {
      headers: getGitHubHeaders(userToken),
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

// Main endpoint to get repository release info (protected)
app.get("/api/repo/:owner/:repo", requireAuth, async (req, res) => {
  const { owner, repo } = req.params;
  const { refresh } = req.query;
  const userToken = req.user.accessToken;

  if (!refresh) {
    const cached = getCachedData(owner, repo);
    if (cached) {
      console.log(`📦 Serving cached data for ${owner}/${repo}`);
      return res.json(cached);
    }
  }

  try {
    const release = await getLatestRelease(owner, repo, userToken);

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

    const [commits, prs] = await Promise.all([
      getCommitsSinceRelease(owner, repo, release.date, userToken),
      getMergedPRsSinceRelease(owner, repo, release.date, userToken),
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
      commits: commits.slice(0, 10),
      prs: prs.slice(0, 10),
    };

    setCachedData(owner, repo, result);
    console.log(`✅ Fetched and cached data for ${owner}/${repo}`);

    res.json(result);
  } catch (error) {
    const statusCode = error.response?.status;
    const errorMessage = error.response?.data?.message || error.message;

    console.error(`Error fetching data for ${owner}/${repo}:`, errorMessage);

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

// Batch endpoint using GraphQL (protected)
app.post("/api/repos/batch", requireAuth, async (req, res) => {
  const { repos, refresh } = req.body;
  const userToken = req.user.accessToken;

  if (!Array.isArray(repos)) {
    return res.status(400).json({ error: "repos must be an array" });
  }

  if (!refresh) {
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
    const BATCH_SIZE = 10;
    const COMMITS_PER_REPO = 30;
    const PRS_PER_REPO = 30;

    const allResults = [];

    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      const batch = repos.slice(i, i + BATCH_SIZE);
      console.log(
        `📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${
          batch.length
        } repos)...`
      );

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

      trackGitHubAPICall(GITHUB_GRAPHQL_URL);
      const graphqlResponse = await axios.post(
        GITHUB_GRAPHQL_URL,
        { query: graphqlQuery },
        { headers: getGraphQLHeaders(userToken) }
      );

      if (graphqlResponse.data.errors) {
        console.error(
          `GraphQL errors in batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          graphqlResponse.data.errors
        );
        batch.forEach((repo) => {
          allResults.push({
            owner: repo.owner,
            repo: repo.repo,
            error:
              graphqlResponse.data.errors[0]?.message || "GraphQL query error",
            statusCode: 500,
          });
        });
        continue;
      }

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
        continue;
      }

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

      allResults.push(...batchResults);

      if (i + BATCH_SIZE < repos.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

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

// Legacy endpoint (protected)
app.post("/api/repos", requireAuth, async (req, res) => {
  const { repos } = req.body;

  if (!Array.isArray(repos)) {
    return res.status(400).json({ error: "repos must be an array" });
  }

  try {
    const results = await Promise.all(
      repos.map(({ owner, repo }) =>
        axios
          .get(`http://localhost:${PORT}/api/repo/${owner}/${repo}`, {
            headers: { Authorization: req.headers.authorization },
          })
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
let rateLimitResetTime = Date.now() + 60 * 60 * 1000;

function trackGitHubAPICall(url) {
  if (url && (url.includes("api.github.com") || url.includes("github.com"))) {
    apiCallCount++;
    const now = Date.now();
    if (now > rateLimitResetTime) {
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

// API usage stats (public - needed for login page)
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
  console.log(`🔐 Authentication: GitHub OAuth (org: ${ALLOWED_ORG})`);
  console.log(`📈 API rate limit tracking enabled (5000 requests/hour)`);

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.warn(
      `⚠️  GitHub OAuth not configured! Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in server/.env`
    );
  }
});
