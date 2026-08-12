import React from "react";

function FloatingRemi({ onOpen }) {
  return (
    <button className="floating-remi" onClick={onOpen} aria-label="Open Remi assistant">
      <span className="remi-bubble-text">
        <strong>Meet Remi</strong>
        <small>Hii I'm Remi your cozy ramen assistant.</small>
      </span>
      <span className="remi-mini" aria-hidden="true">
        <span className="remi-head">
          <span className="remi-eye left"></span>
          <span className="remi-eye right"></span>
          <span className="remi-smile"></span>
        </span>
        <span className="remi-arm left"></span>
        <span className="remi-arm right"></span>
        <span className="remi-bowl"></span>
      </span>
    </button>
  );
}

export default FloatingRemi;
