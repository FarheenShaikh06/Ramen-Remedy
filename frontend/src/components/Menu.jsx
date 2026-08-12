import React from "react";
import formatPrice from "../utils/formatPrice.js";

const fallbackImage = "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80";

function Menu({ menuItems, onAddToOrder }) {
  function handleImageError(event) {
    event.currentTarget.src = fallbackImage;
  }

  return (
    <section className="section" id="menu">
      <div className="section-heading">
        <p className="eyebrow">Ready-made bowls</p>
        <h2>Pick a comfort bowl</h2>
        <p>Six cozy favorites for when you want dinner to feel easy, warm, and already figured out.</p>
      </div>

      <div className="menu-grid">
        {menuItems.map((item) => (
          <article className="menu-card" key={item.id}>
            <img src={item.image} alt={item.name} onError={handleImageError} />
            <div className="card-body">
              <div className="card-title-row">
                <h3>{item.name}</h3>
                <span>{formatPrice(item.price)}</span>
              </div>
              <p>{item.description}</p>
              <div className="tag-row">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <button className="small-button" onClick={() => onAddToOrder(item)}>
                Add to Order
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Menu;
