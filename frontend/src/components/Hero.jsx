import React from "react";

const heroImage = "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1600&q=85";

function Hero({ settings, onOrderClick, onBuildClick }) {
  const heroStyle = {
    backgroundImage: `linear-gradient(90deg, rgba(25, 19, 15, 0.82), rgba(25, 19, 15, 0.45), rgba(25, 19, 15, 0.18)), url(${heroImage})`,
  };

  return (
    <section className="hero" id="home" style={heroStyle}>
      <div className="hero-content">
        <p className="eyebrow">Fresh ramen, delivered warm</p>
        <h1>{settings?.hero_title || "Ramen Remedy"}</h1>
        <p className="tagline">{settings?.tagline || "A bowl that feels like home."}</p>
        <p className="hero-copy">
          Fresh, comforting ramen bowls made for cozy cravings and delivered to your doorstep.
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={onOrderClick}>
            Order Now
          </button>
          <button className="secondary-button" onClick={onBuildClick}>
            Build Your Bowl
          </button>
        </div>
      </div>
    </section>
  );
}

export default Hero;
