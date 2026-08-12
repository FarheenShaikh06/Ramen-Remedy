import assert from "node:assert/strict";
import test from "node:test";
import { calculateDemoOrder } from "../frontend/src/utils/demoOrder.js";

test("calculates a custom demo bowl from the local catalog", () => {
  const result = calculateDemoOrder(
    {
      broth: "miso",
      noodle: "thick",
      protein: "chicken",
      spiceLevel: "hot",
      toppings: ["corn"],
      quantity: 2,
    },
    {
      customOptions: {
        broth: [{ id: "miso", price: 570 }],
        noodle: [{ id: "thick", price: 80 }],
        protein: [{ id: "chicken", price: 250 }],
        spice: [{ id: "hot", price: 70 }],
      },
      toppings: [{ id: "corn", price: 70 }],
    },
  );

  assert.deepEqual(result, {
    base_price: 970,
    toppings_total: 70,
    quantity: 2,
    total: 2_080,
  });
});
