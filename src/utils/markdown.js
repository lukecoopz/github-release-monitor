const escapeMarkdownText = (text) =>
  String(text).replace(/([\\[\]])/g, "\\$1");

const formatMarkdownDate = (date) => new Date(date).toISOString().slice(0, 10);

const formatListCount = (items, total = items.length) =>
  items.length === total ? `${total}` : `${items.length} of ${total}`;

export const buildChangesMarkdown = (repositories) => {
  const repositoriesWithPullRequests = repositories.filter(
    (repository) => repository.prs && repository.prs.length > 0
  );

  const lines = ["# GitHub Releases"];

  repositoriesWithPullRequests.forEach((repository) => {
    const repositoryName = `${repository.owner}/${repository.repo}`;
    const repositoryUrl = `https://github.com/${repositoryName}`;
    const pullRequests = repository.prs || [];

    lines.push(
      "",
      `## [${escapeMarkdownText(repositoryName)}](${repositoryUrl})`
    );

    if (repository.release) {
      lines.push(
        "",
        `Current release: [${escapeMarkdownText(repository.release.tag)}](${repository.release.url}) (${formatMarkdownDate(repository.release.date)})`
      );
    }

    lines.push(
      "",
      `### Merged pull requests (${formatListCount(
        pullRequests,
        repository.prsCount
      )})`,
      ""
    );
    pullRequests.forEach((pullRequest) => {
      lines.push(
        `- [#${pullRequest.number} ${escapeMarkdownText(pullRequest.title)}](${pullRequest.url}) (${formatMarkdownDate(pullRequest.mergedAt)})`
      );
    });
  });

  return `${lines.join("\n")}\n`;
};
