import React, { useEffect, useState } from "react";
import formatPrice from "../utils/formatPrice.js";

function OrderSummary({ selectedOrder, toppings, apiUrl, confirmation, onOrderPlaced }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });
  const [formError, setFormError] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      setQuantity(selectedOrder.quantity || 1);
      setSelectedToppings(selectedOrder.toppingIds || []);
      setSpecialInstructions(selectedOrder.specialInstructions || "");
      setFormError("");
    }
  }, [selectedOrder]);

  function toggleTopping(toppingId) {
    if (selectedToppings.includes(toppingId)) {
      setSelectedToppings(selectedToppings.filter((id) => id !== toppingId));
    } else {
      setSelectedToppings([...selectedToppings, toppingId]);
    }
  }

  function getToppingTotal() {
    let total = 0;
    for (let topping of toppings) {
      if (selectedToppings.includes(topping.id)) {
        total += topping.price;
      }
    }
    return total;
  }

  function getSelectedToppingNames() {
    const names = [];
    for (let topping of toppings) {
      if (selectedToppings.includes(topping.id)) {
        names.push(topping.name);
      }
    }
    return names;
  }

  function updateCustomer(field, value) {
    setCustomer({
      ...customer,
      [field]: value,
    });
  }

  async function placeOrder(event) {
    event.preventDefault();

    if (!selectedOrder) {
      setFormError("Please choose a ramen bowl first.");
      return;
    }

    const finalTotal = (selectedOrder.bowlBasePrice + getToppingTotal()) * quantity;

    const orderPayload = {
      customer,
      order: {
        type: selectedOrder.type,
        name: selectedOrder.name,
        details: selectedOrder.details,
        toppings: getSelectedToppingNames(),
        quantity,
        specialInstructions,
        paymentMethod: "Cash on Delivery",
        total: Number(finalTotal.toFixed(2)),
      },
    };

    setIsSending(true);
    setFormError("");

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

      onOrderPlaced(data.message);
    } catch (error) {
      setFormError("The backend is not responding. Start Flask and try again.");
    } finally {
      setIsSending(false);
    }
  }

  if (!selectedOrder) {
    return (
      <section className="section order-section" id="order">
        <div className="section-heading">
          <p className="eyebrow">Order summary</p>
          <h2>Your ramen order</h2>
          <p>Choose a menu bowl or build your own ramen, and your order summary will appear here.</p>
        </div>
        <div className="empty-order">
          <h3>No bowl selected yet</h3>
          <p>Start with a ready-made favorite or build a bowl from scratch.</p>
        </div>
      </section>
    );
  }

  const toppingsTotal = getToppingTotal();
  const finalTotal = (selectedOrder.bowlBasePrice + toppingsTotal) * quantity;

  return (
    <section className="section order-section" id="order">
      <div className="section-heading">
        <p className="eyebrow">Order summary</p>
        <h2>Send your bowl home</h2>
        <p>This is a mock order form for project/demo use, with Cash on Delivery shown as the payment option.</p>
      </div>

      <div className="order-layout">
        <div className="summary-panel">
          <img src={selectedOrder.image} alt={selectedOrder.name} />
          <h3>{selectedOrder.name}</h3>
          {selectedOrder.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}

          <label>
            Quantity
            <input
              type="number"
              min="1"
              max="10"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>

          <fieldset>
            <legend>Extra toppings</legend>
            <div className="checkbox-grid compact">
              {toppings.map((topping) => (
                <label className="check-card" key={topping.id}>
                  <input
                    type="checkbox"
                    checked={selectedToppings.includes(topping.id)}
                    onChange={() => toggleTopping(topping.id)}
                  />
                  <span>{topping.name}</span>
                  <small>+{formatPrice(topping.price)}</small>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Bowl note
            <textarea
              value={specialInstructions}
              onChange={(event) => setSpecialInstructions(event.target.value)}
              placeholder="Example: pack chili oil separately..."
            />
          </label>

          <div className="grand-total order-total">
            <span>Final total</span>
            <strong>{formatPrice(finalTotal)}</strong>
          </div>
        </div>

        <form className="delivery-form" onSubmit={placeOrder}>
          <h3>Delivery details</h3>
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
          {confirmation && <p className="confirmation">{confirmation}</p>}

          <button className="primary-button full-width" disabled={isSending}>
            {isSending ? "Placing Order..." : "Place Order"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default OrderSummary;
