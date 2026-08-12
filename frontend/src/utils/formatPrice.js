function formatPrice(amount) {
  return `PKR ${Number(amount).toLocaleString("en-PK")}`;
}

export default formatPrice;
