export function createDemoOrderConfirmation({ customer, order, now = Date.now() }) {
  const customerName = customer?.name?.trim() || "there";
  const bowlName = order?.name || "your ramen bowl";

  return {
    orderNumber: `RR-DEMO-${String(now).slice(-6)}`,
    customerName,
    bowlName,
    total: Number(order?.total || 0),
    isDemo: true,
    message: `Order received, ${customerName}! Your ${bowlName} is queued in the demo kitchen.`,
  };
}

export function calculateDemoOrder(orderData, catalog) {
  const categories = ["broth", "noodle", "protein", "spice"];
  const basePrice = categories.reduce((total, category) => {
    const selectedId = category === "spice" ? orderData.spiceLevel : orderData[category];
    const option = catalog.customOptions?.[category]?.find((item) => item.id === selectedId);
    return total + Number(option?.price || 0);
  }, 0);
  const toppingsTotal = (catalog.toppings || [])
    .filter((topping) => (orderData.toppings || []).includes(topping.id))
    .reduce((total, topping) => total + Number(topping.price || 0), 0);
  const quantity = Math.max(1, Number(orderData.quantity || 1));

  return {
    base_price: basePrice,
    toppings_total: toppingsTotal,
    quantity,
    total: (basePrice + toppingsTotal) * quantity,
  };
}
