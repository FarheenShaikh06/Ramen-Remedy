import React, { useEffect, useState } from "react";
import Hero from "./components/Hero.jsx";
import Menu from "./components/Menu.jsx";
import CustomBuilder from "./components/CustomBuilder.jsx";
import CartPage from "./components/CartPage.jsx";
import CheckoutPage from "./components/CheckoutPage.jsx";
import RemiPage from "./components/RemiPage.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import FloatingRemi from "./components/FloatingRemi.jsx";
import CustomCursor from "./components/CustomCursor.jsx";
import About from "./components/About.jsx";
import Footer from "./components/Footer.jsx";

const API_URL = "http://localhost:5000";

const defaultSiteSettings = {
  primary_color: "#d85d32",
  secondary_color: "#fff8ea",
  logo_url: "",
  tagline: "A bowl that feels like home.",
  hero_title: "Ramen Remedy",
  delivery_fee: "150",
};

const pagePaths = {
  home: "/",
  builder: "/build",
  cart: "/cart",
  checkout: "/checkout",
  remi: "/remi",
  admin: "/admin",
};

function getPageFromPath() {
  const path = window.location.pathname.toLowerCase();
  const foundPage = Object.keys(pagePaths).find((pageName) => pagePaths[pageName] === path);
  return foundPage || "home";
}

function App() {
  const [page, setPage] = useState(getPageFromPath);
  const [menuItems, setMenuItems] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [customOptions, setCustomOptions] = useState({ broth: [], noodle: [], protein: [], spice: [] });
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [cartItem, setCartItem] = useState(null);
  const [cartPulse, setCartPulse] = useState(false);
  const [notification, setNotification] = useState("");
  const [apiError, setApiError] = useState("");

  function loadCatalog() {
    setApiError("");

    fetch(`${API_URL}/api/menu`)
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMenuItems(data);
        } else {
          setApiError(data.error || "The menu database is not responding.");
        }
      })
      .catch(() => setApiError("Start the Flask backend to load the live menu."));

    fetch(`${API_URL}/api/toppings`)
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setToppings(data);
        } else {
          setApiError(data.error || "The toppings database is not responding.");
        }
      })
      .catch(() => setApiError("Start the Flask backend to load toppings and prices."));

    fetch(`${API_URL}/api/custom-options`)
      .then((response) => response.json())
      .then((data) => {
        if (data && data.broth && data.noodle && data.protein && data.spice) {
          setCustomOptions(data);
        } else {
          setApiError(data.error || "The custom builder options database is not responding.");
        }
      })
      .catch(() => setApiError("Start the Flask backend to load custom builder options."));

    fetch(`${API_URL}/api/settings`)
      .then((response) => response.json())
      .then((data) => {
        const nextSettings = data.settings || data;
        setSiteSettings({ ...defaultSiteSettings, ...nextSettings });
      })
      .catch(() => setSiteSettings(defaultSiteSettings));
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    function handleBrowserBack() {
      setPage(getPageFromPath());
    }

    window.addEventListener("popstate", handleBrowserBack);

    return () => {
      window.removeEventListener("popstate", handleBrowserBack);
    };
  }, []);

  function showNotification(message) {
    setNotification(message);
    setTimeout(() => setNotification(""), 3200);
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    const nextPath = pagePaths[nextPage] || "/";

    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToMenu() {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }

    if (page !== "home") {
      setPage("home");
      setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }), 120);
    } else {
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function animateCart() {
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 850);
  }

  function addToCart(order, message) {
    setCartItem(order);
    animateCart();
    showNotification(message);
    goToPage("cart");
  }

  function handleMenuOrder(item) {
    addToCart(
      {
        type: "menu",
        name: item.name,
        bowlBasePrice: item.price,
        quantity: 1,
        toppingIds: [],
        specialInstructions: "",
        image: item.image,
        details: ["Ready-made ramen bowl", item.description],
      },
      `${item.name} hopped into your cart. Add toppings next.`
    );
  }

  function handleCustomOrder(customOrder) {
    addToCart(customOrder, "Your custom cozy bowl is in the cart. Time for toppings or checkout.");
  }

  function clearCart() {
    setCartItem(null);
    showNotification("Cart cleared. Fresh bowl energy is waiting.");
    goToPage("home");
  }

  const themeStyle = {
    "--broth": siteSettings.primary_color || defaultSiteSettings.primary_color,
    "--cream": siteSettings.secondary_color || defaultSiteSettings.secondary_color,
  };

  return (
    <div className={`site-shell page-theme-${page}`} style={themeStyle}>
      <CustomCursor />

      <header className="topbar">
        <button className="brand nav-button" onClick={() => goToPage("home")} aria-label="Ramen Remedy home">
          <span className="brand-mark">
            {siteSettings.logo_url ? <img src={siteSettings.logo_url} alt="Ramen Remedy logo" /> : "RR"}
          </span>
          <span>Ramen Remedy</span>
        </button>

        <nav className="nav-links" aria-label="Main navigation">
          <button className={page === "home" ? "active" : ""} onClick={scrollToMenu}>
            Menu
          </button>
          <button className={page === "builder" ? "active" : ""} onClick={() => goToPage("builder")}>
            Build Bowl
          </button>
          <button className={`cart-nav ${page === "cart" ? "active" : ""}`} onClick={() => goToPage("cart")}>
            <span className={cartPulse ? "cart-bowl cart-bowl-pop" : "cart-bowl"}>{"\uD83C\uDF5C"}</span>
            Cart
            {cartItem && <span className="cart-count">{cartItem.quantity || 1}</span>}
          </button>
          <button className={page === "remi" ? "active" : ""} onClick={() => goToPage("remi")}>
            Remi
          </button>
        </nav>
      </header>

      {notification && <div className="toast-note">{notification}</div>}
      {apiError && <p className="api-note">{apiError}</p>}

      <main>
        {page === "home" && (
          <>
            <Hero settings={siteSettings} onOrderClick={scrollToMenu} onBuildClick={() => goToPage("builder")} />
            <Menu menuItems={menuItems} onAddToOrder={handleMenuOrder} />
            <About />
          </>
        )}

        {page === "builder" && (
          <CustomBuilder
            toppings={toppings}
            customOptions={customOptions}
            apiUrl={API_URL}
            onCustomOrder={handleCustomOrder}
          />
        )}

        {page === "cart" && (
          <CartPage
            cartItem={cartItem}
            toppings={toppings}
            onUpdateCart={setCartItem}
            onCheckout={() => goToPage("checkout")}
            onGoMenu={scrollToMenu}
            onGoBuild={() => goToPage("builder")}
            onClearCart={clearCart}
          />
        )}

        {page === "checkout" && (
          <CheckoutPage
            cartItem={cartItem}
            toppings={toppings}
            apiUrl={API_URL}
            settings={siteSettings}
            onBackToCart={() => goToPage("cart")}
            onOrderPlaced={showNotification}
            onGoMenu={scrollToMenu}
          />
        )}

        {page === "remi" && (
          <RemiPage apiUrl={API_URL} onGoBuild={() => goToPage("builder")} onGoMenu={scrollToMenu} />
        )}

        {page === "admin" && <AdminDashboard apiUrl={API_URL} onDataChanged={loadCatalog} />}
      </main>

      {page !== "remi" && page !== "admin" && <FloatingRemi onOpen={() => goToPage("remi")} />}
      <Footer settings={siteSettings} />
    </div>
  );
}

export default App;
