import React from "react";

const setupImage =
  "https://foodandpleasure.com/wp-content/uploads/2023/03/deigo-ramen-barras-de-ramen-3.jpeg";

function About() {
  return (
    <section className="section about-section" id="about">
      <div className="about-layout">
        <div className="about-visual">
          <img src={setupImage} alt="Cozy ramen restaurant setup with warm lights and tables" />
          <div className="about-photo-card">
            <span>Ramen bar mood</span>
            <strong>Warm noodle counter</strong>
          </div>
        </div>

        <div className="about-copy">
          <p className="eyebrow">About us</p>
          <h2>Small kitchen, big comfort</h2>
          <p>
            Ramen Remedy is a cozy ramen delivery concept built around warm bowls, fresh toppings, and food that feels
            personal. The idea is simple: when the day feels long, a comforting bowl of ramen should be only a few clicks
            away.
          </p>
          <div className="about-mini-grid">
            <span>Fresh toppings</span>
            <span>Warm doorstep bowls</span>
            <span>Late-night comfort mood</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default About;
