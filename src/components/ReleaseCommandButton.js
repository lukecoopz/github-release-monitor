import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { buildReleaseCommand, getVersionBumps } from "../utils/releases";

const BUMP_TYPES = ["patch", "minor", "major"];

function ReleaseCommandButton({ owner, repository, currentTag }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("idle");
  const versionBumps = getVersionBumps(currentTag);

  useEffect(() => {
    if (copyStatus === "idle") {
      return undefined;
    }

    const resetTimeout = setTimeout(() => setCopyStatus("idle"), 2000);
    return () => clearTimeout(resetTimeout);
  }, [copyStatus]);

  const copyReleaseCommand = async (bumpType) => {
    const nextTag = versionBumps[bumpType];
    const command = buildReleaseCommand(owner, repository, nextTag);

    try {
      await navigator.clipboard.writeText(command);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy release command:", error);
      setCopyStatus("failed");
    }
    setIsOpen(false);
  };

  const buttonLabel = {
    idle: "Release",
    copied: "Copied!",
    failed: "Copy failed",
  }[copyStatus];

  return (
    <div
      className="release-command-control"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={`clipboard-btn release-command-btn ${copyStatus}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={!versionBumps}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={
          versionBumps
            ? `Copy a GitHub CLI release command for ${owner}/${repository}`
            : `Cannot calculate a release version from ${currentTag}`
        }
      >
        <span aria-hidden="true">{copyStatus === "copied" ? "✓" : "📋"}</span>
        {buttonLabel}
      </button>
      {isOpen && versionBumps && (
        <div className="release-bump-menu" role="menu">
          {BUMP_TYPES.map((bumpType) => (
            <button
              key={bumpType}
              type="button"
              className="release-bump-option"
              role="menuitem"
              onClick={() => copyReleaseCommand(bumpType)}
            >
              <span>{bumpType}</span>
              <code>{versionBumps[bumpType]}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

ReleaseCommandButton.propTypes = {
  owner: PropTypes.string.isRequired,
  repository: PropTypes.string.isRequired,
  currentTag: PropTypes.string.isRequired,
};

export default ReleaseCommandButton;
