import React, { useState } from "react";

function RemiPage({ apiUrl, onGoBuild, onGoMenu }) {
  const [messages, setMessages] = useState([
    {
      sender: "remi",
      text: "Hii, I am Remi. Tell me your ramen mood and I will suggest a ready-made bowl or a custom build.",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [preferences, setPreferences] = useState({
    mood: "cozy",
    spice: "medium",
    diet: "anything",
  });
  const [isThinking, setIsThinking] = useState(false);

  async function askRemi(messageText) {
    const cleanMessage = messageText.trim();

    if (cleanMessage === "") {
      return;
    }

    const recentHistory = messages.slice(-8);

    setMessages((oldMessages) => [...oldMessages, { sender: "user", text: cleanMessage }]);
    setUserInput("");
    setIsThinking(true);

    try {
      const response = await fetch(`${apiUrl}/api/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: cleanMessage, history: recentHistory }),
      });

      const data = await response.json();
      setMessages((oldMessages) => [...oldMessages, { sender: "remi", text: data.reply }]);
    } catch (error) {
      setMessages((oldMessages) => [
        ...oldMessages,
        {
          sender: "remi",
          text: "I cannot reach the kitchen right now. Please start the Flask backend and ask me again.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    askRemi(userInput);
  }

  function updatePreference(field, value) {
    setPreferences({
      ...preferences,
      [field]: value,
    });
  }

  function askFromPreferences() {
    const message = `I want a ${preferences.mood} ramen bowl. Spice level: ${preferences.spice}. Diet preference: ${preferences.diet}. Please suggest ready-made and custom bowl options.`;
    askRemi(message);
  }

  return (
    <section className="page-screen remi-screen">
      <div className="remi-hero">
        <div className="remi-stage">
          <div className="remi-character big" aria-hidden="true">
            <span className="remi-steam remi-steam-one"></span>
            <span className="remi-steam remi-steam-two"></span>
            <span className="remi-face">
              <span className="remi-eye left"></span>
              <span className="remi-eye right"></span>
              <span className="remi-smile"></span>
            </span>
            <span className="remi-arm left"></span>
            <span className="remi-arm right"></span>
            <span className="remi-body-bowl"></span>
          </div>
          <div className="dance-tagline">
            <strong>Meet Remi</strong>
            <span>Hii I'm Remi your cozy ramen assistant.</span>
          </div>
        </div>

        <div className="remi-intro">
          <p className="eyebrow">Assistant page</p>
          <h1>Remi's ramen studio</h1>
          <p>
            Share your cravings, spice level, diet choice, or comfort mood. Remi can suggest menu bowls and custom bowl
            ideas without making the website feel AI-heavy.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onGoBuild}>
              Build Suggested Bowl
            </button>
            <button className="secondary-button" onClick={onGoMenu}>
              Browse Menu
            </button>
          </div>
        </div>
      </div>

      <div className="remi-layout">
        <aside className="preference-card">
          <p className="eyebrow">Preference mixer</p>
          <h2>Tell Remi your mood</h2>
          <label>
            Ramen mood
            <select value={preferences.mood} onChange={(event) => updatePreference("mood", event.target.value)}>
              <option value="cozy">Cozy and comforting</option>
              <option value="spicy">Bold and spicy</option>
              <option value="creamy">Creamy and soft</option>
              <option value="fresh">Fresh and light</option>
            </select>
          </label>
          <label>
            Spice level
            <select value={preferences.spice} onChange={(event) => updatePreference("spice", event.target.value)}>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="hot">Hot</option>
              <option value="fire">Fire</option>
            </select>
          </label>
          <label>
            Diet preference
            <select value={preferences.diet} onChange={(event) => updatePreference("diet", event.target.value)}>
              <option value="anything">Anything works</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="chicken">Chicken</option>
              <option value="seafood">Seafood</option>
            </select>
          </label>
          <button className="primary-button full-width" onClick={askFromPreferences}>
            Ask Remi for Options
          </button>
        </aside>

        <div className="chat-window remi-chat-window">
          <div className="quick-prompts">
            <button onClick={() => askRemi("I like spicy food. What should I order?")}>Spicy pick</button>
            <button onClick={() => askRemi("I want something vegetarian and cozy.")}>Vegetarian cozy</button>
            <button onClick={() => askRemi("Suggest a custom bowl with toppings.")}>Custom bowl idea</button>
            <button onClick={() => askRemi("I want creamy ramen with soft toppings.")}>Creamy comfort</button>
          </div>

          <div className="messages remi-messages">
            {messages.map((message, index) => (
              <div className={`message ${message.sender}`} key={`${message.sender}-${index}`}>
                <span>{message.sender === "remi" ? "Remi" : "You"}</span>
                <p>{message.text}</p>
              </div>
            ))}
            {isThinking && (
              <div className="message remi">
                <span>Remi</span>
                <p>Mixing broth notes and topping ideas...</p>
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              placeholder="Example: I want spicy ramen with chicken and cheese..."
            />
            <button className="small-button">Send</button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default RemiPage;
