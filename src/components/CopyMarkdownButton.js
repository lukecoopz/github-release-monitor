import React from "react";
import PropTypes from "prop-types";
import ClipboardButton from "./ClipboardButton";
import { buildChangesMarkdown } from "../utils/markdown";

function CopyMarkdownButton({ repositories }) {
  const hasPullRequests = repositories.some(
    (repository) => repository.prs && repository.prs.length > 0
  );

  return (
    <ClipboardButton
      text={hasPullRequests ? buildChangesMarkdown(repositories) : ""}
      label="Copy as Markdown"
      className="sort-btn copy-markdown-btn"
      disabled={!hasPullRequests}
      title={
        hasPullRequests
          ? "Copy displayed merged pull requests as Markdown"
          : "No displayed merged pull requests to copy"
      }
    />
  );
}

CopyMarkdownButton.propTypes = {
  repositories: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default CopyMarkdownButton;
