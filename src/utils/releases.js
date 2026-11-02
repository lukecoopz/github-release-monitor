const VERSION_PATTERN = /^(v?)(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export const getVersionBumps = (currentTag) => {
  const versionMatch = currentTag.match(VERSION_PATTERN);
  if (!versionMatch) {
    return null;
  }

  const [, prefix, majorText, minorText, patchText] = versionMatch;
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);

  return {
    patch: `${prefix}${major}.${minor}.${patch + 1}`,
    minor: `${prefix}${major}.${minor + 1}.0`,
    major: `${prefix}${major + 1}.0.0`,
  };
};

export const buildReleaseCommand = (owner, repository, tag) =>
  `gh release create ${tag} --repo ${owner}/${repository} --generate-notes`;
