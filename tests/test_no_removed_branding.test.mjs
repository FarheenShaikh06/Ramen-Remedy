import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url);

function textFilesIn(directoryUrl) {
  const directory = directoryUrl.pathname;
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return textFilesIn(new URL(`file://${path}/`));
    }

    return /\.(css|html|js|jsx|md)$/.test(entry) ? [path] : [];
  });
}

test("public copy does not contain the removed branding", () => {
  const files = [
    join(repoRoot.pathname, "README.md"),
    join(repoRoot.pathname, "frontend/index.html"),
    ...textFilesIn(new URL(`${repoRoot.href}frontend/src/`)),
  ];
  const copy = files.map((file) => readFileSync(file, "utf8")).join("\n");
  const removedName = ["fa", "ri"].join("");

  assert.doesNotMatch(copy, new RegExp(removedName, "i"));
});
