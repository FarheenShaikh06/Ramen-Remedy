import assert from "node:assert/strict";
import test from "node:test";
import { createDemoOrderConfirmation } from "../frontend/src/utils/demoOrder.js";

test("creates a clear demo order confirmation without a backend", () => {
  const confirmation = createDemoOrderConfirmation({
    customer: { name: "Guest" },
    order: { name: "Classic Chicken Ramen", total: 1_000 },
    now: 1_728_000_123_456,
  });

  assert.equal(confirmation.orderNumber, "RR-DEMO-123456");
  assert.equal(confirmation.customerName, "Guest");
  assert.equal(confirmation.bowlName, "Classic Chicken Ramen");
  assert.equal(confirmation.total, 1_000);
  assert.equal(confirmation.isDemo, true);
  assert.match(confirmation.message, /order received/i);
});
