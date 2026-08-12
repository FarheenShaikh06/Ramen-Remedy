import React, { useEffect, useState } from "react";

function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [clicks, setClicks] = useState([]);

  useEffect(() => {
    function handleMove(event) {
      setPosition({ x: event.clientX, y: event.clientY });
    }

    function handleClick(event) {
      const id = Date.now();
      setClicks((oldClicks) => [...oldClicks, { id, x: event.clientX, y: event.clientY }]);
      setTimeout(() => {
        setClicks((oldClicks) => oldClicks.filter((click) => click.id !== id));
      }, 650);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <>
      <div className="ramen-cursor" style={{ left: position.x, top: position.y }} aria-hidden="true">
        🍜
      </div>
      {clicks.map((click) => (
        <span
          className="ramen-click"
          key={click.id}
          style={{ left: click.x, top: click.y }}
          aria-hidden="true"
        >
          🍜
        </span>
      ))}
    </>
  );
}

export default CustomCursor;
