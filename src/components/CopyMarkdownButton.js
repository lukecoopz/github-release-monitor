import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { buildChangesMarkdown } from "../utils/markdown";

function CopyMarkdownButton({ repositories }) {
  const [copyStatus, setCopyStatus] = useState("idle");
  const hasPullRequests = repositories.some(
    (repository) => repository.prs && repository.prs.length > 0
  );

  useEffect(() => {
    if (copyStatus === "idle") {
      return undefined;
    }

    const resetTimeout = setTimeout(() => setCopyStatus("idle"), 2000);
    return () => clearTimeout(resetTimeout);
  }, [copyStatus]);

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(buildChangesMarkdown(repositories));
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy changes as Markdown:", error);
      setCopyStatus("failed");
    }
  };

  const buttonLabel = {
    idle: "Copy as Markdown",
    copied: "Copied!",
    failed: "Copy failed",
  }[copyStatus];

  return (
    <button
      type="button"
      className={`sort-btn copy-markdown-btn ${copyStatus}`}
      onClick={copyMarkdown}
      disabled={!hasPullRequests}
      title={
        hasPullRequests
          ? "Copy displayed merged pull requests as Markdown"
          : "No displayed merged pull requests to copy"
      }
    >
      <span aria-hidden="true">{copyStatus === "copied" ? "✓" : "📋"}</span>
      {buttonLabel}
    </button>
  );
}

CopyMarkdownButton.propTypes = {
  repositories: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default CopyMarkdownButton;
