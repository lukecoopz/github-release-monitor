import { buildReleaseCommand, getVersionBumps } from "./releases";

test("builds major, minor, and patch versions while preserving the prefix", () => {
  expect(getVersionBumps("v1.4.4")).toEqual({
    patch: "v1.4.5",
    minor: "v1.5.0",
    major: "v2.0.0",
  });
  expect(getVersionBumps("1.4.4")).toEqual({
    patch: "1.4.5",
    minor: "1.5.0",
    major: "2.0.0",
  });
});

test("removes prerelease suffixes when bumping", () => {
  expect(getVersionBumps("v1.0.74-hotfix")).toEqual({
    patch: "v1.0.75",
    minor: "v1.1.0",
    major: "v2.0.0",
  });
});

test("rejects tags that are not three-part versions", () => {
  expect(getVersionBumps("release-2026-11-02")).toBeNull();
});

test("builds a GitHub CLI command with generated release notes", () => {
  expect(buildReleaseCommand("dronedeploy", "stormie", "v1.22.0")).toBe(
    "gh release create v1.22.0 --repo dronedeploy/stormie --generate-notes"
  );
});
