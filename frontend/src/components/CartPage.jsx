import React from "react";
import formatPrice from "../utils/formatPrice.js";

const toppingIcons = {
  "boiled-egg": "\uD83E\uDD5A",
  corn: "\uD83C\uDF3D",
  mushrooms: "\uD83C\uDF44",
  "chicken-slices": "\uD83C\uDF57",
  cheese: "\uD83E\uDDC0",
  seaweed: "\uD83C\uDF3F",
  "chili-oil": "\uD83C\uDF36\uFE0F",
  "spring-onions": "\uD83E\uDD57",
  tofu: "\u25FB\uFE0F",
};

function getToppingIcon(toppingId) {
  return toppingIcons[toppingId] || "\u2728";
}

function CartPage({ cartItem, toppings, onUpdateCart, onCheckout, onGoMenu, onGoBuild, onClearCart }) {
  function getToppingTotal() {
    if (!cartItem) {
      return 0;
    }

    let total = 0;
    for (let topping of toppings) {
      if (cartItem.toppingIds.includes(topping.id)) {
        total += topping.price;
      }
    }
    return total;
  }

  function getSelectedToppingNames() {
    if (!cartItem) {
      return [];
    }

    const names = [];
    for (let topping of toppings) {
      if (cartItem.toppingIds.includes(topping.id)) {
        names.push({
          id: topping.id,
          name: topping.name,
        });
      }
    }
    return names;
  }

  function updateQuantity(value) {
    const quantity = Math.max(1, Number(value));
    onUpdateCart({ ...cartItem, quantity });
  }

  function updateInstructions(value) {
    onUpdateCart({ ...cartItem, specialInstructions: value });
  }

  function toggleTopping(toppingId) {
    let nextToppings = [];

    if (cartItem.toppingIds.includes(toppingId)) {
      nextToppings = cartItem.toppingIds.filter((id) => id !== toppingId);
    } else {
      nextToppings = [...cartItem.toppingIds, toppingId];
    }

    onUpdateCart({ ...cartItem, toppingIds: nextToppings });
  }

  if (!cartItem) {
    return (
      <section className="page-screen cart-screen">
        <div className="page-hero-card empty-cart-card">
          <p className="eyebrow">Cart</p>
          <h1>Your cart is still warming up</h1>
          <p>Pick a ready-made bowl from the menu or build your own cozy recipe from scratch.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onGoMenu}>
              Browse Menu
            </button>
            <button className="secondary-button" onClick={onGoBuild}>
              Build Your Bowl
            </button>
          </div>
        </div>
      </section>
    );
  }

  const toppingsTotal = getToppingTotal();
  const finalTotal = (cartItem.bowlBasePrice + toppingsTotal) * cartItem.quantity;
  const selectedToppings = getSelectedToppingNames();

  return (
    <section className="page-screen cart-screen">
      <div className="subpage-heading">
        <p className="eyebrow">Cart journey</p>
        <h1>Your bowl landed in the cart</h1>
        <p>Add toppings, check the total, then move to checkout when the bowl feels right.</p>
      </div>

      <div className="cart-steps" aria-label="Cart steps">
        <span className="done">1. Bowl added</span>
        <span className="active">2. Add toppings</span>
        <span>3. Checkout</span>
      </div>

      <div className="cart-layout">
        <article className="cart-item-panel">
          <div className="cart-bowl-stage" aria-hidden="true">
            <span className="cart-bowl-large">{"\uD83C\uDF5C"}</span>
            <span className="steam steam-one"></span>
            <span className="steam steam-two"></span>
            <span className="steam steam-three"></span>
          </div>

          <div className="cart-main-row">
            <img src={cartItem.image} alt={cartItem.name} />
            <div className="cart-copy">
              <h2>{cartItem.name}</h2>
              {cartItem.details.map((detail) => (
                <p key={detail}>{detail}</p>
              ))}

              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={cartItem.quantity}
                  onChange={(event) => updateQuantity(event.target.value)}
                />
              </label>

              <label>
                Bowl note
                <textarea
                  value={cartItem.specialInstructions}
                  onChange={(event) => updateInstructions(event.target.value)}
                  placeholder="Example: extra broth, pack chili oil separately..."
                />
              </label>
            </div>
          </div>

          <div className="selected-topping-card">
            <p className="eyebrow">Current topping mood</p>
            {selectedToppings.length ? (
              <div className="selected-chip-row">
                {selectedToppings.map((name) => (
                  <span key={name.id}>
                    {getToppingIcon(name.id)} {name.name}
                  </span>
                ))}
              </div>
            ) : (
              <p>No extras yet. Try boiled egg, corn, or chili oil for a fuller bowl.</p>
            )}
          </div>

          <div className="cart-support-grid">
            <div className="cart-support-card warm">
              <span>01</span>
              <strong>Broth stays cozy</strong>
              <p>Mock delivery packs your bowl with separate toppings so the texture still feels fresh.</p>
            </div>
            <div className="cart-support-card">
              <span>02</span>
              <strong>Best combo</strong>
              <p>Boiled egg + spring onions + chili oil gives the bowl a classic ramen shop finish.</p>
            </div>
            <div className="cart-support-card dark">
              <span>03</span>
              <strong>Ready for checkout</strong>
              <p>Review toppings here, then add delivery details on the next screen.</p>
            </div>
          </div>
        </article>

        <aside className="topping-cart-panel">
          <p className="eyebrow">Topping bar</p>
          <h2>Make it yours</h2>
          <div className="cart-topping-grid">
            {toppings.map((topping) => (
              <label className="check-card topping-choice" key={topping.id}>
                <div className="option-card-top">
                  <span className="option-icon">{getToppingIcon(topping.id)}</span>
                  <input
                    type="checkbox"
                    checked={cartItem.toppingIds.includes(topping.id)}
                    onChange={() => toggleTopping(topping.id)}
                  />
                </div>
                <span>{topping.name}</span>
                <small>+{formatPrice(topping.price)}</small>
              </label>
            ))}
          </div>

          <div className="cart-receipt">
            <div className="price-line">
              <span>Bowl</span>
              <strong>{formatPrice(cartItem.bowlBasePrice)}</strong>
            </div>
            <div className="price-line">
              <span>Toppings</span>
              <strong>{formatPrice(toppingsTotal)}</strong>
            </div>
            <div className="price-line">
              <span>Selected</span>
              <strong>{selectedToppings.length || "None yet"}</strong>
            </div>
            <div className="grand-total">
              <span>Total</span>
              <strong>{formatPrice(finalTotal)}</strong>
            </div>
          </div>

          <button className="primary-button full-width" onClick={onCheckout}>
            Go to Checkout
          </button>
          <button className="text-button full-width" onClick={onClearCart}>
            Clear cart
          </button>
        </aside>
      </div>
    </section>
  );
}

export default CartPage;
