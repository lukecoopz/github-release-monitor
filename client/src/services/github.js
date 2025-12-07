/**
 * GitHub API Service - Client-side only
 * Makes all GitHub API calls directly from the browser using the user's token
 */

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

// Configuration
const CONFIG = {
  allowedOrg: "dronedeploy", // Change this to your organization
};

/**
 * Get headers for GitHub API requests
 */
function getHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

/**
 * Get headers for GraphQL requests
 */
function getGraphQLHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Verify a GitHub token and get user info
 */
export async function verifyToken(token) {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: getHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid token. Please check your Personal Access Token.");
    }
    throw new Error("Failed to verify token");
  }

  return response.json();
}

/**
 * Check if user is a member of the allowed organization
 */
export async function verifyOrgMembership(token, username) {
  // Try direct membership check first
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/orgs/${CONFIG.allowedOrg}/members/${username}`,
      { headers: getHeaders(token) }
    );
    if (response.status === 204) {
      return true;
    }
  } catch (e) {
    // Continue to fallback
  }

  // Fallback: Check user's orgs list
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user/orgs`, {
      headers: getHeaders(token),
    });
    if (response.ok) {
      const orgs = await response.json();
      if (orgs.some((org) => org.login.toLowerCase() === CONFIG.allowedOrg.toLowerCase())) {
        return true;
      }
    }
  } catch (e) {
    // Continue to fallback
  }

  // Final fallback: Try to access org's private repos
  // This verifies both org membership AND that the token has 'repo' scope
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/orgs/${CONFIG.allowedOrg}/repos?type=private&per_page=1`,
      { headers: getHeaders(token) }
    );
    
    // If we get 403, the token lacks 'repo' scope or user isn't a member
    if (response.status === 403) {
      return false;
    }
    
    // If we get 401, the token is invalid
    if (response.status === 401) {
      throw new Error("Invalid token. Please check your Personal Access Token.");
    }
    
    if (response.ok) {
      // Even if repos array is empty, a 200 response means we have access
      return true;
    }
  } catch (e) {
    // If it's an auth error, re-throw it
    if (e.message?.includes("Invalid token")) {
      throw e;
    }
    // Otherwise, user doesn't have access
  }

  return false;
}

/**
 * Fetch repository data using GraphQL (batched)
 */
export async function fetchRepositoriesBatch(token, repos) {
  const BATCH_SIZE = 10;
  const COMMITS_PER_REPO = 30;
  const PRS_PER_REPO = 30;
  
  const allResults = [];

  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);

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

    const graphqlQuery = `query { ${repoQueries} }`;

    try {
      const response = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: getGraphQLHeaders(token),
        body: JSON.stringify({ query: graphqlQuery }),
      });

      // Check HTTP response status first
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid token. Please check your Personal Access Token.");
        }
        if (response.status === 403) {
          throw new Error("Token lacks required permissions. Please ensure it has 'repo' and 'read:org' scopes.");
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        console.error("GraphQL errors:", data.errors);
        // Check if it's an authentication/authorization error
        const authError = data.errors.find(err => 
          err.message?.includes("401") || 
          err.message?.includes("403") ||
          err.message?.toLowerCase().includes("bad credentials") ||
          err.message?.toLowerCase().includes("authentication")
        );
        
        if (authError) {
          throw new Error("Authentication failed. Please check your token is valid and has the required scopes.");
        }
        
        batch.forEach((repo) => {
          allResults.push({
            owner: repo.owner,
            repo: repo.repo,
            error: data.errors[0]?.message || "GraphQL query error",
          });
        });
        continue;
      }

      // Process results
      const batchResults = batch.map((repo, index) => {
        const alias = `repo${index}`;
        const repoData = data.data?.[alias];

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
            date: repoData.latestRelease.publishedAt || repoData.latestRelease.createdAt,
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
          return {
            owner: repo.owner,
            repo: repo.repo,
            release: null,
            hasChanges: false,
            commits: [],
            prs: [],
            error: "No releases or tags found",
          };
        }

        const releaseDate = new Date(release.date);
        
        const commits = (repoData.defaultBranchRef?.target?.history?.nodes || [])
          .filter((commit) => new Date(commit.committedDate) > releaseDate)
          .map((commit) => ({
            sha: commit.oid ? commit.oid.substring(0, 7) : "unknown",
            message: commit.message ? commit.message.split("\n")[0] : "No message",
            author: commit.author?.name || "Unknown",
            date: commit.committedDate,
            url: commit.url || `https://github.com/${repo.owner}/${repo.repo}/commit/${commit.oid}`,
          }));

        const prs = (repoData.pullRequests?.nodes || [])
          .filter((pr) => pr.mergedAt && new Date(pr.mergedAt) > releaseDate)
          .map((pr) => ({
            number: pr.number,
            title: pr.title,
            mergedAt: pr.mergedAt,
            author: pr.author?.login || "Unknown",
            url: pr.url,
          }));

        return {
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
      });

      allResults.push(...batchResults);

      // Small delay between batches
      if (i + BATCH_SIZE < repos.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("Batch fetch error:", error);
      
      // If it's an authentication error, throw it so the app can handle it
      if (error.message?.includes("Invalid token") || 
          error.message?.includes("Authentication failed") ||
          error.message?.includes("lacks required permissions")) {
        throw error;
      }
      
      batch.forEach((repo) => {
        allResults.push({
          owner: repo.owner,
          repo: repo.repo,
          error: error.message || "Failed to fetch repository data",
        });
      });
    }
  }

  return allResults;
}

/**
 * Get rate limit info
 */
export async function getRateLimit(token) {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const core = data.resources.core;
    const graphql = data.resources.graphql;
    
    return {
      used: core.limit - core.remaining,
      limit: core.limit,
      remaining: core.remaining,
      percentage: Math.round(((core.limit - core.remaining) / core.limit) * 100),
      resetAt: new Date(core.reset * 1000).toISOString(),
      resetInMinutes: Math.max(0, Math.floor((core.reset * 1000 - Date.now()) / 60000)),
      graphql: {
        used: graphql.limit - graphql.remaining,
        limit: graphql.limit,
        remaining: graphql.remaining,
      },
    };
  } catch (error) {
    console.error("Failed to get rate limit:", error);
    return null;
  }
}

export { CONFIG };

