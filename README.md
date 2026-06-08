# GitHub Release Dashboard

A simple dashboard tool to monitor GitHub repository releases and track pending changes since the last release. Perfect for teams that manually trigger releases and need visibility into when new changes are ready.

**Live Demo**: [lukecoopz.github.io/github-release-monitor](https://lukecoopz.github.io/github-release-monitor/)

## Features

- 🔐 **Organization-Restricted Access** - Only organization members can access the dashboard
- 🔑 **Personal Access Token Login** - Each user authenticates with their own GitHub PAT
- 📊 View current release version and date for each repository
- 🔔 Visual indicator when there are changes merged since last release
- 📝 See recent commits and merged PRs
- 🎨 Clean, modern UI with dark/light theme support
- ⚡ Efficient GraphQL batching (fetches all repos in minimal API calls)
- 💾 Persistent localStorage caching - no API calls on page refresh
- 📈 Real-time API usage tracking widget
- 🌐 **Fully static** - Hosted on GitHub Pages, no server required

## Quick Start (GitHub Pages)

The app is deployed to GitHub Pages and requires no server setup.

### For Users

1. Visit [lukecoopz.github.io/github-release-monitor](https://lukecoopz.github.io/github-release-monitor/)
2. Create a GitHub Personal Access Token:
   - Go to [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=repo,read:org&description=Release%20Dashboard)
   - Select scopes: `repo` and `read:org`
   - Click "Generate token"
3. Paste your token in the login page
4. Done! Your token is stored locally in your browser

### Benefits of Token-Based Auth

| Feature        | Description                                  |
| -------------- | -------------------------------------------- |
| **Rate Limit** | Each user gets their own 5,000 requests/hour |
| **Security**   | Token never leaves your browser              |
| **No Server**  | Everything runs client-side                  |
| **No Setup**   | Just create a token and go                   |

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm

### Install & Run

```bash
cd client
npm install
npm start
```

The app will open at `http://localhost:3000`

## Configuration

### Changing the Allowed Organization

Edit `client/src/services/github.js`:

```javascript
const CONFIG = {
  allowedOrg: "your-organization", // Change this
};
```

### Adding/Removing Repositories

Edit `client/src/App.js` and update the `repos` array:

```javascript
const [repos] = useState([
  { owner: "your-org", repo: "repo-name" },
  { owner: "your-org", repo: "another-repo" },
  // Add more repos here
]);
```

## Deployment

### Deploy to GitHub Pages

```bash
cd client
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch.

### GitHub Pages Settings

1. Go to your repo's **Settings** → **Pages**
2. Set **Source** to: `Deploy from a branch`
3. Set **Branch** to: `gh-pages` / `/ (root)`
4. Save and wait 1-2 minutes

### Custom Domain (Optional)

1. Add a `CNAME` file to `client/public/` with your domain
2. Update `homepage` in `client/package.json`
3. Configure DNS with your domain provider

## How It Works

1. **Authentication**: User enters their GitHub PAT. The app verifies they're a member of the allowed organization by checking their org memberships.

2. **Release Detection**: Uses GitHub's GraphQL API to batch-fetch latest releases/tags for all repositories efficiently.

3. **Change Detection**: After finding each release date, queries for:

   - Commits on default branch after the release
   - Pull requests merged after the release

4. **Caching**: Data is cached in localStorage for 24 hours. Click "Refresh" to fetch fresh data.

5. **Visual Indicators**:
   - "New Changes" badge on repos with pending changes
   - Highlighted card border for repos needing attention
   - Recent PRs and commits listed for quick review
   - API usage widget shows your rate limit status

## Project Structure

```
microservice-playground/
├── client/
│   ├── public/
│   │   ├── index.html        # HTML template with SPA redirect
│   │   ├── 404.html          # GitHub Pages SPA fallback
│   │   └── robot.png         # App icon
│   ├── src/
│   │   ├── App.js            # Main dashboard component
│   │   ├── App.css           # Dashboard styles
│   │   ├── Login.js          # Login page component
│   │   ├── Login.css         # Login page styles
│   │   └── services/
│   │       └── github.js     # GitHub API service (client-side)
│   └── package.json
└── README.md
```

## Troubleshooting

### "Access denied" Error

- Ensure you're a member of the organization (default: `dronedeploy`)
- Your token needs `read:org` scope to verify membership

### "Invalid token" Error

- Check that your token hasn't expired
- Verify the token has `repo` and `read:org` scopes
- Try generating a new token

### Rate Limit Issues

- Each user gets 5,000 requests/hour with their own token
- Check the API usage widget in the top-right corner
- Data is cached - only click Refresh when needed

### Repository Not Found

- Your token needs access to the repository
- Private repos require the `repo` scope
- Check the repository owner/name is correct

### Session Expired

- Sessions expire after 24 hours
- Simply enter your token again

## Security

- **Tokens stay local**: Your GitHub PAT is stored only in your browser's localStorage
- **No server**: All API calls go directly from your browser to GitHub
- **Org verification**: Users must be members of the configured organization
- **HTTPS only**: GitHub Pages enforces HTTPS

## License

MIT
