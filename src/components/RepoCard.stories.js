import RepoCard from "./RepoCard";

const release = {
  tag: "v2.4.0",
  url: "https://github.com/dronedeploy/stormie/releases/tag/v2.4.0",
  date: "2026-05-20T10:00:00Z",
};

const withChangesData = {
  owner: "dronedeploy",
  repo: "stormie",
  release,
  hasChanges: true,
  commitsCount: 12,
  prsCount: 3,
  prs: [
    {
      number: 482,
      title: "Add retry backoff to upload pipeline",
      url: "https://github.com/dronedeploy/stormie/pull/482",
      mergedAt: "2026-06-01T14:30:00Z",
    },
    {
      number: 479,
      title: "Fix flaky integration test",
      url: "https://github.com/dronedeploy/stormie/pull/479",
      mergedAt: "2026-05-28T09:12:00Z",
    },
  ],
  commits: [
    {
      sha: "a1b2c3d",
      message: "Bump dependencies",
      url: "https://github.com/dronedeploy/stormie/commit/a1b2c3d",
      date: "2026-06-02T08:00:00Z",
    },
    {
      sha: "e4f5g6h",
      message: "Tidy logging",
      url: "https://github.com/dronedeploy/stormie/commit/e4f5g6h",
      date: "2026-06-01T16:45:00Z",
    },
  ],
};

const noChangesData = {
  owner: "dronedeploy",
  repo: "backoff",
  release,
  hasChanges: false,
};

const noReleaseData = {
  owner: "dronedeploy",
  repo: "button",
  release: null,
};

const rateLimitData = {
  owner: "dronedeploy",
  repo: "victor",
  error: "GitHub API rate limit exceeded",
};

const meta = {
  title: "Components/RepoCard",
  component: RepoCard,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile2" } },
};

export default meta;

export const WithChanges = {
  args: { data: withChangesData },
};

export const NoChanges = {
  args: { data: noChangesData },
};

export const NoRelease = {
  args: { data: noReleaseData },
};

export const RateLimitError = {
  args: { data: rateLimitData },
};

export const Grid = {
  globals: { viewport: { value: undefined } },
  render: () => (
    <div className="dashboard">
      {[
        withChangesData,
        noChangesData,
        { ...withChangesData, repo: "pigeon", hasChanges: true, prsCount: 1 },
        noReleaseData,
        { ...noChangesData, repo: "minty" },
        rateLimitData,
        { ...withChangesData, repo: "giraffe", commitsCount: 4, prsCount: 2 },
        { ...noChangesData, repo: "dora" },
      ].map((repoData) => (
        <RepoCard key={repoData.repo} data={repoData} />
      ))}
    </div>
  ),
};
