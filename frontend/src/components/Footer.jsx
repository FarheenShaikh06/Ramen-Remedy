import React from "react";

function Footer({ settings }) {
  return (
    <footer className="footer">
      <div>
        <h2>{settings?.hero_title || "Ramen Remedy"}</h2>
        <p>{settings?.tagline || "A bowl that feels like home."}</p>
      </div>
      <div>
        <p>Contact: hello@ramenremedy.test</p>
        <p>Phone: 0300-1234567</p>
      </div>
      <div>
        <p>Instagram: @ramenremedy</p>
        <p>TikTok: @ramenremedy</p>
      </div>
      <p className="footer-line">Made for warm cravings, quiet evenings, and doorstep comfort.</p>
    </footer>
  );
}

export default Footer;
