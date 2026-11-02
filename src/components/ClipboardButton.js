import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

function ClipboardButton({ text, label, title, className = "", disabled = false }) {
  const [copyStatus, setCopyStatus] = useState("idle");

  useEffect(() => {
    if (copyStatus === "idle") {
      return undefined;
    }

    const resetTimeout = setTimeout(() => setCopyStatus("idle"), 2000);
    return () => clearTimeout(resetTimeout);
  }, [copyStatus]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      setCopyStatus("failed");
    }
  };

  const buttonLabel = {
    idle: label,
    copied: "Copied!",
    failed: "Copy failed",
  }[copyStatus];

  return (
    <button
      type="button"
      className={`clipboard-btn ${copyStatus} ${className}`.trim()}
      onClick={copyText}
      disabled={disabled}
      title={title}
    >
      <span aria-hidden="true">{copyStatus === "copied" ? "✓" : "📋"}</span>
      {buttonLabel}
    </button>
  );
}

ClipboardButton.propTypes = {
  text: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default ClipboardButton;
