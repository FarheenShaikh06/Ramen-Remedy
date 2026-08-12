import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../frontend/src/App.jsx", import.meta.url), "utf8");

test("demo catalog fallback does not surface the backend-status banner", () => {
  assert.doesNotMatch(appSource, /setApiError\("Demo mode: the frontend is ready\./);
});
