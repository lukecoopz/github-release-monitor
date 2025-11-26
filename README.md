# GitHub Release Dashboard

A simple dashboard tool to monitor GitHub repository releases and track pending changes since the last release. Perfect for teams that manually trigger releases and need visibility into when new changes are ready.

## Features

- 📊 View current release version and date for each repository
- 🔔 Visual indicator when there are changes merged since last release
- 📝 See recent commits and merged PRs
- 🎨 Clean, modern UI with responsive design (6-column grid)
- ⚡ Efficient API with GraphQL batching and caching
- 💾 Persistent caching (localStorage + server-side) - no API calls on page refresh
- 📈 Real-time API usage tracking widget

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install all dependencies:

```bash
npm run install-all
```

2. (Required for private repos) Set up GitHub token:
   - Create a `.env` file in the `server/` directory
   - Add your GitHub personal access token:
   ```
   GITHUB_TOKEN=your_token_here
   ```
   - Get a token from: https://github.com/settings/tokens
   - Required for accessing private repositories
   - Increases rate limit from 60 to 5000 requests/hour

### Running the Application

Start both the backend server and frontend client:

```bash
npm run dev
```

This will start:

- Backend API on `http://localhost:3001`
- Frontend dashboard on `http://localhost:3000`

## Configuration

### Adding Repositories

Edit `client/src/App.js` and update the `repos` array. Repositories are automatically sorted alphabetically:

```javascript
const [repos] = useState([
  { owner: "dronedeploy", repo: "rocos-console" },
  { owner: "dronedeploy", repo: "another-repo" },
  // Add more repos here
]);
```

**Note:** All repositories use `dronedeploy` as the owner by default.

## How It Works

1. **Release Detection**: Uses GraphQL to batch-fetch latest release tags for all repositories in a single API call. Falls back to latest git tag if no releases exist.

2. **Change Detection**: After finding the release date, queries for:

   - Commits merged after the release date
   - Pull requests merged after the release date

3. **Caching Strategy**:

   - **Server-side**: In-memory cache (persists until server restart)
   - **Client-side**: localStorage cache (persists across page refreshes)
   - **No auto-refresh**: Data only updates when you click the Refresh button
   - Page refreshes load from cache - no API calls made

4. **Visual Indicators**:
   - Repositories with pending changes show a "New Changes" badge above the repo name
   - The card has a highlighted border when changes are detected
   - Recent PRs and commits are listed for quick review
   - API usage widget in top-right shows current rate limit status

## API Endpoints

### POST `/api/repos/batch`

Batch endpoint that fetches all repositories efficiently using GraphQL. This is the primary endpoint used by the dashboard.

**Request:**

```json
{
  "repos": [
    { "owner": "dronedeploy", "repo": "rocos-console" },
    { "owner": "dronedeploy", "repo": "another-repo" }
  ],
  "refresh": false
}
```

**Response:**

```json
[
  {
    "owner": "dronedeploy",
    "repo": "rocos-console",
    "release": {
      "tag": "v1.2.3",
      "date": "2024-01-15T10:30:00Z",
      "name": "Release v1.2.3",
      "url": "https://github.com/..."
    },
    "hasChanges": true,
    "commitsCount": 15,
    "prsCount": 3,
    "commits": [...],
    "prs": [...]
  }
]
```

### GET `/api/usage`

Get current GitHub API usage statistics.

**Response:**

```json
{
  "used": 35,
  "limit": 5000,
  "remaining": 4965,
  "percentage": 1,
  "resetInMinutes": 45,
  "resetAt": "2024-01-15T11:00:00Z"
}
```

### GET `/api/repo/:owner/:repo`

Get release information for a single repository (legacy endpoint).

## Project Structure

```
microservice-playground/
├── server/           # Backend API (Express)
│   ├── index.js     # Main server file
│   └── package.json
├── client/           # Frontend (React)
│   ├── src/
│   │   ├── App.js   # Main dashboard component
│   │   └── App.css  # Styles
│   └── package.json
└── package.json      # Root package.json with scripts
```

## Troubleshooting

### Rate Limit Issues

If you see rate limit errors:

1. Check the API usage widget in the top-right corner to see current usage
2. The dashboard uses caching to minimize API calls - data persists until you click Refresh
3. **API Call Breakdown**:
   - 1 GraphQL call to fetch all releases/tags (batched for all repos)
   - 53 REST calls for commits (1 per repo)
   - 53 REST calls for PRs (1 per repo)
   - **Total: 107 API calls per refresh** (for 53 repositories)
4. Add a GitHub token to `server/.env` to increase limit from 60 to 5000/hour
5. With 5000 requests/hour, you can refresh ~46 times per hour (5000 ÷ 107)
6. Wait for the rate limit to reset (usually 1 hour)

### No Releases Found

If a repository shows "No releases found":

- The repo might not have any releases or tags
- Check that the owner/repo name is correct
- Verify you have access to the repository

### Widget Not Showing

If the API usage widget doesn't appear:

- Restart the server to register the `/api/usage` endpoint
- Check browser console for errors
- Verify the server is running on port 3001

## License

MIT
