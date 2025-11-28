# GitHub Release Dashboard

A simple dashboard tool to monitor GitHub repository releases and track pending changes since the last release. Perfect for teams that manually trigger releases and need visibility into when new changes are ready.

## Features

- 🔐 **GitHub OAuth Authentication** - Only organization members can access the dashboard
- 🔑 **Quick Token Login** - Alternative login using server's GitHub token (for development)
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

### Install Dependencies

```bash
npm run install-all
```

### Authentication Options

The dashboard supports two authentication methods. You can configure one or both:

---

## Option A: Quick Setup (Token-Based Login)

The simplest way to get started. Uses the server's GitHub token to authenticate.

### 1. Create a GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Select scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (Read org membership)
4. Generate and copy the token

### 2. Configure Environment

Create a `.env` file in the `server/` directory:

```bash
# Required: GitHub token with org repo access
GITHUB_TOKEN=ghp_your_token_here

# Required: Organization to restrict access to
ALLOWED_ORG=dronedeploy

# Optional: Restrict token login to specific users (comma-separated)
# Default: lukecoopz
ALLOWED_TOKEN_USERS=lukecoopz

# Optional: Override default URLs
CLIENT_URL=http://localhost:3000
PORT=3001
```

> **Security Note**: Token login is restricted to specific GitHub users (default: `lukecoopz`). The token must belong to one of the allowed users.

### 3. Run the Application

```bash
npm run dev
```

The login page will show a **"🔑 Quick Login (Server Token)"** button.

> **Note**: This method uses a shared token. All users will make API calls using the same token's rate limit. Best for development/internal use.

---

## Option B: Full Setup (GitHub OAuth)

Recommended for production. Each user authenticates with their own GitHub account.

### 1. Create a GitHub OAuth App

1. Go to your GitHub organization settings: `https://github.com/organizations/YOUR_ORG/settings/applications`
   - Or for personal: `https://github.com/settings/developers`
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name**: `GitHub Release Dashboard`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/callback`
4. Click **"Register application"**
5. Copy the **Client ID**
6. Click **"Generate a new client secret"** and copy it

### 2. Configure Environment

Create a `.env` file in the `server/` directory:

```bash
# GitHub OAuth credentials
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here

# Organization to restrict access to
ALLOWED_ORG=dronedeploy

# Optional: Override default URLs
CLIENT_URL=http://localhost:3000
PORT=3001
```

### 3. Run the Application

```bash
npm run dev
```

The login page will show a **"Sign in with GitHub"** button.

---

## Using Both Methods

You can configure both methods. The login page will show both options:

```bash
# server/.env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
ALLOWED_ORG=dronedeploy
```

This is useful when:

- OAuth is preferred but token login is a fallback
- Different team members prefer different methods
- Testing OAuth while developing

## Authentication Flow

### OAuth Flow

1. User clicks "Sign in with GitHub"
2. Redirected to GitHub to authorize the app
3. GitHub redirects back with authorization code
4. Server exchanges code for access token
5. Server verifies user is a member of the allowed organization
6. Session created with user's own token

### Token Flow

1. User clicks "Quick Login (Server Token)"
2. Server verifies the token can access org's private repos
3. Session created using the token owner's identity
4. All API calls use the server's token

## Configuration

### Changing the Allowed Organization

Update the `ALLOWED_ORG` variable in `server/.env`:

```bash
ALLOWED_ORG=your-organization
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

## How It Works

1. **Authentication**: Verifies users are members of the allowed organization via OAuth or token-based verification.

2. **Release Detection**: Uses GraphQL to batch-fetch latest release tags for all repositories in a single API call. Falls back to latest git tag if no releases exist.

3. **Change Detection**: After finding the release date, queries for:

   - Commits merged after the release date
   - Pull requests merged after the release date

4. **Caching Strategy**:

   - **Server-side**: In-memory cache (persists until server restart)
   - **Client-side**: localStorage cache (persists across page refreshes)
   - **No auto-refresh**: Data only updates when you click the Refresh button

5. **Visual Indicators**:
   - Repositories with pending changes show a "New Changes" badge
   - The card has a highlighted border when changes are detected
   - Recent PRs and commits are listed for quick review
   - API usage widget shows current rate limit status

## API Endpoints

### Authentication

| Endpoint                    | Method | Description                             |
| --------------------------- | ------ | --------------------------------------- |
| `/api/auth/check`           | GET    | Check which auth methods are configured |
| `/api/auth/github`          | GET    | Get GitHub OAuth URL                    |
| `/api/auth/github/callback` | POST   | Exchange OAuth code for session         |
| `/api/auth/token-login`     | POST   | Login using server's GITHUB_TOKEN       |
| `/api/auth/me`              | GET    | Get current user (requires auth)        |
| `/api/auth/logout`          | POST   | Logout and destroy session              |

### Protected Endpoints (require authentication)

| Endpoint                 | Method | Description                 |
| ------------------------ | ------ | --------------------------- |
| `/api/repos/batch`       | POST   | Batch fetch repository data |
| `/api/repo/:owner/:repo` | GET    | Get single repository data  |
| `/api/repos`             | POST   | Legacy batch endpoint       |

### Public Endpoints

| Endpoint     | Method | Description              |
| ------------ | ------ | ------------------------ |
| `/api/usage` | GET    | Get API usage statistics |

## Project Structure

```
microservice-playground/
├── server/
│   ├── index.js          # Main server with OAuth & API
│   ├── package.json
│   └── .env              # Environment variables (create this)
├── client/
│   ├── src/
│   │   ├── App.js        # Main dashboard component
│   │   ├── App.css       # Dashboard styles
│   │   ├── Login.js      # Login page component
│   │   ├── Login.css     # Login page styles
│   │   └── AuthCallback.js # OAuth callback handler
│   └── package.json
└── package.json          # Root package.json with scripts
```

## Troubleshooting

### "Access denied" Error

- Ensure you're a member of the organization specified in `ALLOWED_ORG`
- For token login: Verify the `GITHUB_TOKEN` has access to org private repos
- For OAuth: Check that your OAuth app has the correct callback URL

### "Token does not have access" Error

- The `GITHUB_TOKEN` needs `repo` and `read:org` scopes
- The token owner must be a member of the `ALLOWED_ORG`
- Try generating a new token with the correct permissions

### "User not authorized for token-based login" Error

- Token login is restricted to specific GitHub users
- Default allowed user is `lukecoopz`
- To allow other users, set `ALLOWED_TOKEN_USERS` in `server/.env`:
  ```bash
  ALLOWED_TOKEN_USERS=lukecoopz,anotheruser,thirduser
  ```
- The token must belong to one of the allowed users

### OAuth Callback Error

- Make sure the callback URL in your GitHub OAuth App matches exactly: `http://localhost:3000/auth/callback`
- Check that `CLIENT_URL` in `.env` matches your frontend URL

### Rate Limit Issues

1. **OAuth users**: Each user gets their own 5000 requests/hour
2. **Token users**: Share the server token's 5000 requests/hour
3. Check the API usage widget in the top-right corner
4. Use caching - data persists until you click Refresh

### Session Expired

- Sessions expire after 24 hours
- Simply sign in again

### No Login Buttons Showing

- Check that at least one auth method is configured in `server/.env`
- Verify the server is running and accessible
- Check browser console for errors

## Deployment

For production deployment:

1. **Use OAuth** (recommended for production)

   - Token login shares one rate limit across all users
   - OAuth gives each user their own rate limit

2. Update the GitHub OAuth App:

   - **Homepage URL**: Your production URL
   - **Callback URL**: `https://your-domain.com/auth/callback`

3. Update `server/.env`:

   ```bash
   CLIENT_URL=https://your-domain.com
   ```

4. Set up HTTPS (required for OAuth in production)

## License

MIT
