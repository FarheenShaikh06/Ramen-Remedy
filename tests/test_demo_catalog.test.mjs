import test from "node:test";
import assert from "node:assert/strict";
import { demoCatalog } from "../frontend/src/data/demoCatalog.js";


test("demo catalog gives the frontend visible bowls and builder choices", () => {
  assert.equal(demoCatalog.menuItems.length, 6);
  assert.ok(demoCatalog.menuItems.every((item) => item.name && item.image && item.tags.length));
  assert.equal(demoCatalog.toppings.length, 9);
  assert.ok(demoCatalog.customOptions.broth.length);
  assert.ok(demoCatalog.customOptions.noodle.length);
  assert.ok(demoCatalog.customOptions.protein.length);
  assert.ok(demoCatalog.customOptions.spice.length);
});
