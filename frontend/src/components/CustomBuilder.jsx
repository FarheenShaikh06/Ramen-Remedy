import React, { useEffect, useState } from "react";
import formatPrice from "../utils/formatPrice.js";
import { calculateDemoOrder } from "../utils/demoOrder.js";

const emptyOptionGroups = { broth: [], noodle: [], protein: [], spice: [] };

const fallbackOptionIcons = {
  broth: "\uD83C\uDF5C",
  noodle: "\uD83C\uDF5D",
  protein: "\u2728",
  spice: "\uD83C\uDF36\uFE0F",
};

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

function findLabel(options, selectedId) {
  const foundOption = options.find((option) => option.id === selectedId);
  return foundOption ? foundOption.name : selectedId;
}

function getOptionIcon(option, category) {
  if (option && option.icon) {
    return option.icon;
  }

  return fallbackOptionIcons[category] || "\u2728";
}

function findIcon(options, selectedId, category) {
  const foundOption = options.find((option) => option.id === selectedId);
  return getOptionIcon(foundOption, category);
}

function getToppingIcon(topping) {
  return topping.icon || toppingIcons[topping.id] || "\u2728";
}

function keepSelectedOption(currentValue, options) {
  if (options.some((option) => option.id === currentValue)) {
    return currentValue;
  }

  return options[0]?.id || "";
}

function CustomBuilder({ toppings, customOptions = emptyOptionGroups, apiUrl, onCustomOrder }) {
  const brothOptions = customOptions.broth || [];
  const noodleOptions = customOptions.noodle || [];
  const proteinOptions = customOptions.protein || [];
  const spiceOptions = customOptions.spice || [];

  const [broth, setBroth] = useState("");
  const [noodle, setNoodle] = useState("");
  const [protein, setProtein] = useState("");
  const [spiceLevel, setSpiceLevel] = useState("");
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [calculation, setCalculation] = useState(null);
  const [priceError, setPriceError] = useState("");

  useEffect(() => {
    setBroth((currentValue) => keepSelectedOption(currentValue, brothOptions));
    setNoodle((currentValue) => keepSelectedOption(currentValue, noodleOptions));
    setProtein((currentValue) => keepSelectedOption(currentValue, proteinOptions));
    setSpiceLevel((currentValue) => keepSelectedOption(currentValue, spiceOptions));
  }, [customOptions]);

  useEffect(() => {
    if (!broth || !noodle || !protein || !spiceLevel) {
      setCalculation(null);
      setPriceError("Custom options are loading from Supabase.");
      return;
    }

    const orderData = {
      broth,
      noodle,
      protein,
      spiceLevel,
      toppings: selectedToppings,
      quantity,
    };

    if (!apiUrl) {
      setCalculation(calculateDemoOrder(orderData, { customOptions, toppings }));
      setPriceError("");
      return;
    }

    let requestWasCancelled = false;

    fetch(`${apiUrl}/api/calculate-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (requestWasCancelled) {
          return;
        }

        if (data.error) {
          setCalculation(null);
          setPriceError(data.error);
        } else {
          setCalculation(data);
          setPriceError("");
        }
      })
      .catch(() => {
        setCalculation(null);
        setPriceError("Start the Flask backend to calculate your custom bowl.");
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [apiUrl, broth, noodle, protein, spiceLevel, selectedToppings, quantity]);

  function toggleTopping(toppingId) {
    if (selectedToppings.includes(toppingId)) {
      setSelectedToppings(selectedToppings.filter((id) => id !== toppingId));
    } else {
      setSelectedToppings([...selectedToppings, toppingId]);
    }
  }

  function sendCustomOrder() {
    if (!calculation) {
      return;
    }

    onCustomOrder({
      type: "custom",
      name: "Custom Cozy Bowl",
      bowlBasePrice: calculation.base_price,
      quantity,
      toppingIds: selectedToppings,
      specialInstructions,
      image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
      details: [
        `Broth: ${findLabel(brothOptions, broth)}`,
        `Noodles: ${findLabel(noodleOptions, noodle)}`,
        `Protein: ${findLabel(proteinOptions, protein)}`,
        `Spice: ${findLabel(spiceOptions, spiceLevel)}`,
      ],
    });
  }

  return (
      <section className="section builder-section" id="builder">
        <div className="section-heading">
          <p className="eyebrow">Build your bowl</p>
          <h2>Make ramen your way</h2>
          <p>Choose the broth, noodles, protein, spice, and toppings. Your total updates as you build.</p>
        </div>
        {priceError && !calculation && <p className="form-error builder-load-note">{priceError}</p>}

        <div className="builder-layout">
          <div className="builder-panel">
            <fieldset>
              <legend>Broth type</legend>
              <div className="option-grid">
                {brothOptions.map((option) => (
                  <label className="option-pill" key={option.id}>
                    <div className="option-card-top">
                      <span className="option-icon">{getOptionIcon(option, "broth")}</span>
                      <input
                        type="radio"
                        name="broth"
                        value={option.id}
                        checked={broth === option.id}
                        onChange={(event) => setBroth(event.target.value)}
                      />
                    </div>
                    <span>{option.name}</span>
                    <small>{option.note}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="two-column-fields">
              <label>
                <span className="field-label-with-icon">
                  <span>{findIcon(noodleOptions, noodle, "noodle")}</span>
                  Noodle type
                </span>
                <select value={noodle} onChange={(event) => setNoodle(event.target.value)}>
                  {noodleOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {getOptionIcon(option, "noodle")} {option.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="field-label-with-icon">
                  <span>{findIcon(proteinOptions, protein, "protein")}</span>
                  Protein
                </span>
                <select value={protein} onChange={(event) => setProtein(event.target.value)}>
                  {proteinOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {getOptionIcon(option, "protein")} {option.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="field-label-with-icon">
                  <span>{findIcon(spiceOptions, spiceLevel, "spice")}</span>
                  Spice level
                </span>
                <select value={spiceLevel} onChange={(event) => setSpiceLevel(event.target.value)}>
                  {spiceOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {getOptionIcon(option, "spice")} {option.name}
                    </option>
                  ))}
                </select>
              </label>

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
            </div>

            <fieldset>
              <legend>Toppings</legend>
              <div className="checkbox-grid">
                {toppings.map((topping) => (
                  <label className="check-card" key={topping.id}>
                    <div className="option-card-top">
                      <span className="option-icon">{getToppingIcon(topping)}</span>
                      <input
                        type="checkbox"
                        checked={selectedToppings.includes(topping.id)}
                        onChange={() => toggleTopping(topping.id)}
                      />
                    </div>
                    <span>{topping.name}</span>
                    <small>+{formatPrice(topping.price)}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <label>
              Special instructions or custom recipe note
              <textarea
                value={specialInstructions}
                onChange={(event) => setSpecialInstructions(event.target.value)}
                placeholder="Example: extra broth, less chili, more spring onions..."
              />
            </label>
          </div>

          <aside className="price-panel">
            <p className="eyebrow">Live total</p>
            {calculation ? (
              <>
                <div className="price-line">
                  <span>Base bowl</span>
                  <strong>{formatPrice(calculation.base_price)}</strong>
                </div>
                <div className="price-line">
                  <span>Toppings</span>
                  <strong>{formatPrice(calculation.toppings_total)}</strong>
                </div>
                <div className="price-line">
                  <span>Quantity</span>
                  <strong>{calculation.quantity}</strong>
                </div>
                <div className="grand-total">
                  <span>Total</span>
                  <strong>{formatPrice(calculation.total)}</strong>
                </div>
              </>
            ) : (
              <p>{priceError || "Calculating your bowl..."}</p>
            )}
            {priceError && <p className="form-error">{priceError}</p>}
            <button className="primary-button full-width" onClick={sendCustomOrder} disabled={!calculation}>
              Add Custom Bowl
            </button>
          </aside>
        </div>
      </section>
  );
}

export default CustomBuilder;
