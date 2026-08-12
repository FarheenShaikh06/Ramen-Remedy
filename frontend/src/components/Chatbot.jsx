import React, { useState } from "react";

function Chatbot({ apiUrl }) {
  const [messages, setMessages] = useState([
    {
      sender: "remi",
      text: "Hi, I am Remi. Tell me what you are craving and I will help you choose a ramen bowl.",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  async function sendMessage(messageText) {
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
        { sender: "remi", text: "I cannot reach the kitchen right now. Please start the Flask backend and try again." },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(userInput);
  }

  return (
    <section className="section chatbot-section" id="remi">
      <div className="section-heading">
        <p className="eyebrow">Remi chat</p>
        <h2>Meet Remi, your cozy ramen assistant.</h2>
        <p>Ask for spicy picks, vegetarian ideas, topping suggestions, or simple delivery help.</p>
      </div>

      <div className="chatbot-layout">
        <div className="quick-prompts">
          <button onClick={() => sendMessage("I like spicy food. What should I order?")}>Spicy pick</button>
          <button onClick={() => sendMessage("I want something vegetarian.")}>Vegetarian</button>
          <button onClick={() => sendMessage("What toppings do you have?")}>Toppings</button>
          <button onClick={() => sendMessage("How does delivery work?")}>Delivery</button>
        </div>

        <div className="chat-window">
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.sender}`} key={`${message.sender}-${index}`}>
                <span>{message.sender === "remi" ? "Remi" : "You"}</span>
                <p>{message.text}</p>
              </div>
            ))}
            {isThinking && (
              <div className="message remi">
                <span>Remi</span>
                <p>Thinking of a cozy bowl...</p>
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              placeholder="Ask Remi what to order..."
            />
            <button className="small-button">Send</button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default Chatbot;
