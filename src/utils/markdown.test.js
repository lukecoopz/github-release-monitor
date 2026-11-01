import { buildChangesMarkdown } from "./markdown";

test("builds Markdown from merged pull requests in repository order", () => {
  const repositories = [
    {
      owner: "dronedeploy",
      repo: "stormie",
      hasChanges: true,
      release: {
        tag: "v2.4.0",
        url: "https://github.com/dronedeploy/stormie/releases/tag/v2.4.0",
        date: "2026-05-20T10:00:00Z",
      },
      prsCount: 2,
      prs: [
        {
          number: 482,
          title: "Support [retry] backoff",
          url: "https://github.com/dronedeploy/stormie/pull/482",
          mergedAt: "2026-06-01T14:30:00Z",
        },
      ],
    },
    {
      owner: "dronedeploy",
      repo: "backoff",
      hasChanges: true,
      commits: [{ sha: "a1b2c3d", message: "Commit without a PR" }],
      prs: [],
    },
  ];

  expect(buildChangesMarkdown(repositories)).toBe(
    [
      "# GitHub Releases",
      "",
      "## [dronedeploy/stormie](https://github.com/dronedeploy/stormie)",
      "",
      "Current release: [v2.4.0](https://github.com/dronedeploy/stormie/releases/tag/v2.4.0) (2026-05-20)",
      "",
      "### Merged pull requests (1 of 2)",
      "",
      "- [#482 Support \\[retry\\] backoff](https://github.com/dronedeploy/stormie/pull/482) (2026-06-01)",
      "",
    ].join("\n")
  );
});
