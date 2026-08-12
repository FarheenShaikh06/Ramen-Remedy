import React, { useState } from "react";
import formatPrice from "../utils/formatPrice.js";
import { createDemoOrderConfirmation } from "../utils/demoOrder.js";

function CheckoutPage({ cartItem, toppings, apiUrl, settings, onBackToCart, onOrderPlaced, onGoMenu }) {
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });
  const [formError, setFormError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [isSending, setIsSending] = useState(false);

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
        names.push(topping.name);
      }
    }
    return names;
  }

  function getDeliveryFee() {
    return Number(settings?.delivery_fee || 0);
  }

  function updateCustomer(field, value) {
    setCustomer({
      ...customer,
      [field]: value,
    });
  }

  async function placeOrder(event) {
    event.preventDefault();

    if (!cartItem) {
      setFormError("Please add a ramen bowl before checkout.");
      return;
    }

    const finalTotal = (cartItem.bowlBasePrice + getToppingTotal()) * cartItem.quantity + getDeliveryFee();

    const orderPayload = {
      customer,
      order: {
        type: cartItem.type,
        name: cartItem.name,
        details: cartItem.details,
        toppings: getSelectedToppingNames(),
        quantity: cartItem.quantity,
        specialInstructions: cartItem.specialInstructions,
        paymentMethod: "Cash on Delivery",
        deliveryFee: getDeliveryFee(),
        total: Number(finalTotal.toFixed(2)),
      },
    };

    setIsSending(true);
    setFormError("");

    if (!apiUrl) {
      const demoConfirmation = createDemoOrderConfirmation({
        customer,
        order: orderPayload.order,
      });
      setConfirmation(demoConfirmation);
      onOrderPlaced(`Order ${demoConfirmation.orderNumber} received — demo only.`);
      setIsSending(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/place-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || "Please check your delivery details.");
        return;
      }

      setConfirmation({
        orderNumber: data.orderNumber || "RR-ONLINE",
        customerName: customer.name.trim() || "there",
        bowlName: orderPayload.order.name,
        total: orderPayload.order.total,
        isDemo: false,
        message: data.message || "Your order has been received.",
      });
      onOrderPlaced("Order placed. Your cozy confirmation is ready.");
    } catch (error) {
      setFormError("The backend is not responding. Start Flask and try again.");
    } finally {
      setIsSending(false);
    }
  }

  if (!cartItem) {
    return (
      <section className="page-screen checkout-screen">
        <div className="page-hero-card">
          <p className="eyebrow">Checkout</p>
          <h1>No bowl in checkout yet</h1>
          <p>Choose something warm first, then checkout will be ready for delivery details.</p>
          <button className="primary-button" onClick={onGoMenu}>
            Browse Menu
          </button>
        </div>
      </section>
    );
  }

  const deliveryFee = getDeliveryFee();
  const finalTotal = (cartItem.bowlBasePrice + getToppingTotal()) * cartItem.quantity + deliveryFee;
  const selectedToppings = getSelectedToppingNames();

  return (
    <section className="page-screen checkout-screen">
      <div className="subpage-heading checkout-heading">
        <p className="eyebrow">Checkout</p>
        <h1>Final stop before cozy delivery</h1>
        <p>Review your bowl, add your details, and place a mock order for your internship demo.</p>
      </div>

      <div className="checkout-layout">
        <aside className="checkout-summary">
          <img src={cartItem.image} alt={cartItem.name} />
          <h2>{cartItem.name}</h2>
          <p>{cartItem.details[0]}</p>
          <p>
            <strong>Toppings:</strong> {selectedToppings.length ? selectedToppings.join(", ") : "No extra toppings"}
          </p>
          <p>
            <strong>Quantity:</strong> {cartItem.quantity}
          </p>
          <p>
            <strong>Delivery fee:</strong> {formatPrice(deliveryFee)}
          </p>
          {cartItem.specialInstructions && (
            <p>
              <strong>Bowl note:</strong> {cartItem.specialInstructions}
            </p>
          )}
          <div className="grand-total order-total">
            <span>Final total</span>
            <strong>{formatPrice(finalTotal)}</strong>
          </div>
          <div className="payment-summary">
            <span>Payment</span>
            <strong>Cash on Delivery</strong>
          </div>
          <button className="secondary-button full-width" onClick={onBackToCart}>
            Back to Cart
          </button>
        </aside>

        {confirmation ? (
          <div className="delivery-form checkout-form order-confirmation" role="status">
            <div className="confirmation-mark" aria-hidden="true">
              ✓
            </div>
            <p className="eyebrow">Kitchen ticket received</p>
            <h2>Ramen is on its way, {confirmation.customerName}.</h2>
            <p className="confirmation-message">{confirmation.message}</p>

            <div className="confirmation-details">
              <div>
                <span>Order number</span>
                <strong>{confirmation.orderNumber}</strong>
              </div>
              <div>
                <span>Your bowl</span>
                <strong>{confirmation.bowlName}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatPrice(confirmation.total)}</strong>
              </div>
            </div>

            <p className="confirmation-note">
              {confirmation.isDemo
                ? "This is a demo order: no payment was taken and no delivery was placed."
                : "Payment method: Cash on Delivery."}
            </p>
            <button className="primary-button full-width" onClick={onGoMenu}>
              Order another bowl
            </button>
          </div>
        ) : (
          <form className="delivery-form checkout-form" onSubmit={placeOrder}>
            <h2>Delivery details</h2>
            <label>
              Customer name
              <input
                type="text"
                value={customer.name}
                onChange={(event) => updateCustomer("name", event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Phone number
              <input
                type="tel"
                value={customer.phone}
                onChange={(event) => updateCustomer("phone", event.target.value)}
                placeholder="0300 0000000"
              />
            </label>
            <label>
              Delivery address
              <textarea
                value={customer.address}
                onChange={(event) => updateCustomer("address", event.target.value)}
                placeholder="House number, street, area, city"
              />
            </label>
            <label>
              Special delivery note
              <textarea
                value={customer.note}
                onChange={(event) => updateCustomer("note", event.target.value)}
                placeholder="Example: call when outside"
              />
            </label>

            <fieldset className="payment-options">
              <legend>Payment option</legend>
              <label className="payment-card">
                <input type="radio" checked readOnly />
                <span>
                  <strong>Cash on Delivery</strong>
                  <small>Pay in PKR when your mock ramen order arrives.</small>
                </span>
              </label>
            </fieldset>

            {formError && <p className="form-error">{formError}</p>}

            <button className="primary-button full-width" disabled={isSending}>
              {isSending ? "Placing Order..." : "Place Demo Order"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default CheckoutPage;
