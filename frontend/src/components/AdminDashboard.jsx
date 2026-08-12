import React, { useEffect, useState } from "react";
import formatPrice from "../utils/formatPrice.js";

const emptyMenuForm = {
  id: "",
  name: "",
  description: "",
  price: "",
  image: "",
  tags: "",
  sort_order: 99,
  is_available: true,
};

const emptyToppingForm = {
  id: "",
  name: "",
  price: "",
  icon: "",
  is_available: true,
};

const emptyCustomOptionForm = {
  id: "",
  category: "broth",
  name: "",
  note: "",
  price: "",
  icon: "",
  sort_order: 99,
  is_available: true,
};

const customOptionCategories = [
  { id: "broth", name: "Broth" },
  { id: "noodle", name: "Noodle" },
  { id: "protein", name: "Protein" },
  { id: "spice", name: "Spice" },
];

const toppingIconFallbacks = {
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

const customOptionIconFallbacks = {
  broth: "\uD83C\uDF5C",
  noodle: "\uD83C\uDF5D",
  protein: "\u2728",
  spice: "\uD83C\uDF36\uFE0F",
};

const orderStatuses = ["pending", "preparing", "out for delivery", "delivered", "cancelled"];

function formatDate(value) {
  if (!value) {
    return "Not saved yet";
  }

  return new Date(value).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function categoryName(categoryId) {
  const foundCategory = customOptionCategories.find((category) => category.id === categoryId);
  return foundCategory ? foundCategory.name : categoryId;
}

function getToppingIcon(item) {
  return item.icon || toppingIconFallbacks[item.id] || "\uD83C\uDF5C";
}

function getCustomOptionIcon(item) {
  return item.icon || customOptionIconFallbacks[item.category] || "\u2728";
}

function summarizeDevResult(result) {
  if (!result) {
    return "";
  }

  if (Array.isArray(result)) {
    return result
      .slice(0, 8)
      .map((item) => item.name || item.orderNumber || item.id)
      .filter(Boolean)
      .join(", ");
  }

  return JSON.stringify(result);
}

function formatActionName(actionType) {
  if (!actionType) {
    return "Admin action";
  }

  return actionType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function shortenText(value, limit = 90) {
  const text = String(value || "").trim();

  if (text.length <= limit) {
    return text || "none";
  }

  return text.slice(0, limit).trim() + "...";
}

function getLogTarget(log) {
  const value = log.newValue || log.oldValue || {};

  if (value.name) {
    return value.name;
  }

  if (value.order_number) {
    return value.order_number;
  }

  if (value.setting_key) {
    return value.setting_key.replaceAll("_", " ");
  }

  return log.targetId || "selected record";
}

function formatStoredPrice(value) {
  const amount = value?.price_pkr ?? value?.price ?? value?.total_pkr;
  return amount === undefined || amount === null ? "" : formatPrice(amount);
}

function formatLogValue(log, value) {
  if (!value) {
    return "none";
  }

  if (typeof value === "string") {
    return shortenText(value);
  }

  const actionType = log.actionType || "";

  if (log.targetTable === "menu_items") {
    if (actionType.includes("price")) {
      return formatStoredPrice(value);
    }

    if (actionType.includes("description")) {
      return shortenText(value.description);
    }

    if (actionType.includes("unavailable") || actionType.includes("delete")) {
      return value.is_available ? "Visible" : "Hidden";
    }

    return value.name || "menu item saved";
  }

  if (log.targetTable === "toppings") {
    if (actionType.includes("price")) {
      return formatStoredPrice(value);
    }

    if (actionType.includes("delete")) {
      return value.is_available ? "Visible" : "Hidden";
    }

    return value.name || "topping saved";
  }

  if (log.targetTable === "orders") {
    return value.status || "order updated";
  }

  if (log.targetTable === "site_settings") {
    if (value.setting_key === "delivery_fee") {
      return formatPrice(value.setting_value || 0);
    }

    return shortenText(value.setting_value);
  }

  return shortenText(JSON.stringify(value));
}

function formatLogTime(value) {
  if (!value) {
    return "Not saved";
  }

  return new Date(value).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminDashboard({ apiUrl, onDataChanged }) {
  const [token, setToken] = useState(localStorage.getItem("ramen_admin_token") || "");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("menu");
  const [status, setStatus] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [customOptions, setCustomOptions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  const [toppingForm, setToppingForm] = useState(emptyToppingForm);
  const [customOptionForm, setCustomOptionForm] = useState(emptyCustomOptionForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devInput, setDevInput] = useState("");
  const [devMessages, setDevMessages] = useState([
    {
      sender: "assistant",
      text: "Hi, I am RemiDev. Your developer assistant. Tell me the change and I will prepare a safe preview first.",
    },
  ]);
  const [pendingDevAction, setPendingDevAction] = useState(null);
  const [lastUndoLog, setLastUndoLog] = useState(null);
  const [adminLogs, setAdminLogs] = useState([]);
  const [devLoading, setDevLoading] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (token) {
      loadAdminData();
    }
  }, [token]);

  function showMessage(text) {
    setMessage(text);
    setError("");
    setTimeout(() => setMessage(""), 3200);
  }

  function showError(text) {
    setError(text);
    setMessage("");
  }

  async function readJson(response) {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Admin request failed.");
    }

    return data;
  }

  function friendlyRequestError(requestError) {
    if (requestError.message === "Failed to fetch") {
      return "I cannot reach the Flask backend right now. Restart Flask on http://localhost:5000, then try again.";
    }

    return requestError.message;
  }

  async function login(event) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await readJson(response);
      localStorage.setItem("ramen_admin_token", data.token);
      setToken(data.token);
      setPassword("");
      showMessage("Admin login successful.");
    } catch (requestError) {
      showError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("ramen_admin_token");
    setToken("");
    setPassword("");
    setStatus(null);
    setMenuItems([]);
    setToppings([]);
    setCustomOptions([]);
    setOrders([]);
    setMenuForm(emptyMenuForm);
    setToppingForm(emptyToppingForm);
    setCustomOptionForm(emptyCustomOptionForm);
    setPendingDevAction(null);
    setLastUndoLog(null);
    setAdminLogs([]);
    showMessage("Admin logged out.");
  }

  async function loadAdminData() {
    setIsLoading(true);
    setError("");

    try {
      const [statusData, menuData, toppingsData, customOptionsData, ordersData] = await Promise.all([
        fetch(`${apiUrl}/api/admin/status`, { headers }).then(readJson),
        fetch(`${apiUrl}/api/admin/menu`, { headers }).then(readJson),
        fetch(`${apiUrl}/api/admin/toppings`, { headers }).then(readJson),
        fetch(`${apiUrl}/api/admin/custom-options`, { headers }).then(readJson),
        fetch(`${apiUrl}/api/admin/orders`, { headers }).then(readJson),
      ]);

      const logsData = await fetch(`${apiUrl}/api/admin/logs`, { headers })
        .then(readJson)
        .catch(() => []);

      setStatus(statusData);
      setMenuItems(menuData);
      setToppings(toppingsData);
      setCustomOptions(customOptionsData);
      setOrders(ordersData);
      setAdminLogs(logsData);
    } catch (requestError) {
      showError(friendlyRequestError(requestError));
      if (requestError.message.toLowerCase().includes("admin login")) {
        localStorage.removeItem("ramen_admin_token");
        setToken("");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function updateMenuForm(field, value) {
    setMenuForm({
      ...menuForm,
      [field]: value,
    });
  }

  function updateToppingForm(field, value) {
    setToppingForm({
      ...toppingForm,
      [field]: value,
    });
  }

  function updateCustomOptionForm(field, value) {
    setCustomOptionForm({
      ...customOptionForm,
      [field]: value,
    });
  }

  function editMenuItem(item) {
    setActiveTab("menu");
    setMenuForm({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      tags: item.tags.join(", "),
      sort_order: item.sort_order || 99,
      is_available: item.is_available !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editTopping(item) {
    setActiveTab("toppings");
    setToppingForm({
      id: item.id,
      name: item.name,
      price: item.price,
      icon: item.icon || "",
      is_available: item.is_available !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editCustomOption(item) {
    setActiveTab("options");
    setCustomOptionForm({
      id: item.id,
      category: item.category,
      name: item.name,
      note: item.note || "",
      price: item.price,
      icon: item.icon || "",
      sort_order: item.sort_order || 99,
      is_available: item.is_available !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveMenuItem(event) {
    event.preventDefault();
    const isEditing = Boolean(menuForm.id);
    const url = isEditing ? `${apiUrl}/api/admin/menu/${menuForm.id}` : `${apiUrl}/api/admin/menu`;

    try {
      await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers,
        body: JSON.stringify(menuForm),
      }).then(readJson);

      setMenuForm(emptyMenuForm);
      await loadAdminData();
      onDataChanged();
      showMessage(isEditing ? "Menu item updated." : "Menu item added.");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  async function toggleMenuVisibility(item) {
    const nextVisible = item.is_available === false;

    try {
      await fetch(`${apiUrl}/api/admin/menu/${item.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...item, is_available: nextVisible }),
      }).then(readJson);

      await loadAdminData();
      onDataChanged();
      showMessage(nextVisible ? "Menu item is visible again." : "Menu item hidden from public menu.");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  async function saveTopping(event) {
    event.preventDefault();
    const isEditing = Boolean(toppingForm.id);
    const url = isEditing ? `${apiUrl}/api/admin/toppings/${toppingForm.id}` : `${apiUrl}/api/admin/toppings`;

    try {
      await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers,
        body: JSON.stringify(toppingForm),
      }).then(readJson);

      setToppingForm(emptyToppingForm);
      await loadAdminData();
      onDataChanged();
      showMessage(isEditing ? "Topping updated." : "Topping added.");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  async function toggleToppingVisibility(item) {
    const nextVisible = item.is_available === false;

    try {
      await fetch(`${apiUrl}/api/admin/toppings/${item.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...item, is_available: nextVisible }),
      }).then(readJson);

      await loadAdminData();
      onDataChanged();
      showMessage(nextVisible ? "Topping is visible again." : "Topping hidden from public choices.");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  async function saveCustomOption(event) {
    event.preventDefault();
    const isEditing = Boolean(customOptionForm.id);
    const url = isEditing
      ? `${apiUrl}/api/admin/custom-options/${customOptionForm.id}`
      : `${apiUrl}/api/admin/custom-options`;

    try {
      await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers,
        body: JSON.stringify(customOptionForm),
      }).then(readJson);

      setCustomOptionForm(emptyCustomOptionForm);
      await loadAdminData();
      onDataChanged();
      showMessage(isEditing ? "Builder option updated." : "Builder option added.");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  async function toggleCustomOptionVisibility(item) {
    const nextVisible = item.is_available === false;

    try {
      await fetch(`${apiUrl}/api/admin/custom-options/${item.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...item, is_available: nextVisible }),
      }).then(readJson);

      await loadAdminData();
      onDataChanged();
      showMessage(nextVisible ? "Builder option is visible again." : "Builder option hidden from public builder.");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  async function updateOrderStatus(orderId, statusValue) {
    try {
      await fetch(`${apiUrl}/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: statusValue }),
      }).then(readJson);

      await loadAdminData();
      showMessage("Order status updated.");
    } catch (requestError) {
      showError(requestError.message);
    }
  }

  async function sendDevCommand(event) {
    event.preventDefault();

    if (!devInput.trim()) {
      return;
    }

    const userText = devInput.trim();
    setDevInput("");
    setDevLoading(true);
    setPendingDevAction(null);
    setLastUndoLog(null);
    setDevMessages((currentMessages) => [...currentMessages, { sender: "user", text: userText }]);

    try {
      const response = await fetch(`${apiUrl}/api/admin/dev-assistant`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: userText }),
      });
      const data = await readJson(response);
      const resultText = summarizeDevResult(data.result);

      setDevMessages((currentMessages) => [
        ...currentMessages,
        {
          sender: "assistant",
          text: data.message + (resultText ? `\n${resultText}` : ""),
        },
      ]);

      if (data.needsConfirmation) {
        setPendingDevAction(data.action);
      }
    } catch (requestError) {
      setDevMessages((currentMessages) => [...currentMessages, { sender: "assistant", text: friendlyRequestError(requestError) }]);
    } finally {
      setDevLoading(false);
    }
  }

  async function confirmDevAction() {
    if (!pendingDevAction) {
      return;
    }

    setDevLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/admin/confirm-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: pendingDevAction }),
      });
      const data = await readJson(response);
      setPendingDevAction(null);
      setLastUndoLog(data.log || null);
      setDevMessages((currentMessages) => [
        ...currentMessages,
        { sender: "assistant", text: data.message },
      ]);
      await loadAdminData();
      onDataChanged();
    } catch (requestError) {
      setDevMessages((currentMessages) => [...currentMessages, { sender: "assistant", text: friendlyRequestError(requestError) }]);
    } finally {
      setDevLoading(false);
    }
  }

  function cancelDevAction() {
    setPendingDevAction(null);
    setDevMessages((currentMessages) => [...currentMessages, { sender: "assistant", text: "Cancelled. No changes were applied." }]);
  }

  async function rollbackLog(logId) {
    setDevLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/admin/rollback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ logId }),
      });
      const data = await readJson(response);
      if (lastUndoLog && lastUndoLog.id === logId) {
        setLastUndoLog(null);
      }
      setDevMessages((currentMessages) => [...currentMessages, { sender: "assistant", text: data.message }]);
      await loadAdminData();
      onDataChanged();
    } catch (requestError) {
      setDevMessages((currentMessages) => [...currentMessages, { sender: "assistant", text: friendlyRequestError(requestError) }]);
    } finally {
      setDevLoading(false);
    }
  }

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrders = orders.filter((order) => order.status === "pending").length;

  if (!token) {
    return (
      <section className="page-screen admin-screen">
        <div className="admin-login-card">
          <p className="eyebrow">Admin dashboard</p>
          <h1>Manage Ramen Remedy</h1>
          <p>
            Log in to edit menu prices, update toppings, and view customer mock orders from the database.
          </p>
          <form onSubmit={login}>
            <label>
              Admin password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter ADMIN_PASSWORD"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            {message && <p className="confirmation">{message}</p>}
            <button className="primary-button full-width" disabled={isLoading}>
              {isLoading ? "Checking..." : "Open Admin Dashboard"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="page-screen admin-screen">
      <div className="subpage-heading admin-heading">
        <p className="eyebrow">Admin dashboard</p>
        <h1>Manage Ramen Remedy</h1>
        <p>Edit bowls, prices, add-ons and order status.</p>
      </div>

      {message && <p className="confirmation admin-alert">{message}</p>}
      {error && <p className="form-error admin-alert">{error}</p>}

      <div className="admin-stat-grid">
        <div>
          <span>Database mode</span>
          <strong>{status?.databaseMode || "checking"}</strong>
        </div>
        <div>
          <span>Menu items</span>
          <strong>{menuItems.length}</strong>
        </div>
        <div>
          <span>Builder options</span>
          <strong>{customOptions.length}</strong>
        </div>
        <div>
          <span>Orders</span>
          <strong>{orders.length}</strong>
        </div>
        <div>
          <span>Revenue</span>
          <strong>{formatPrice(totalRevenue)}</strong>
        </div>
      </div>

      {activeTab !== "dev" && (
        <button className="floating-remidev" onClick={() => setActiveTab("dev")} type="button" aria-label="Open RemiDev">
          <span className="remidev-bubble-text">
            <strong>Meet RemiDev</strong>
            <small>Hi, I'm RemiDev - your Developer Assistant.</small>
          </span>
          <span className="remi-mini remidev-floating-mini" aria-hidden="true">
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
      )}

      <div className="admin-tabs">
        <button className={activeTab === "menu" ? "active" : ""} onClick={() => setActiveTab("menu")}>
          Menu
        </button>
        <button className={activeTab === "toppings" ? "active" : ""} onClick={() => setActiveTab("toppings")}>
          Toppings
        </button>
        <button className={activeTab === "options" ? "active" : ""} onClick={() => setActiveTab("options")}>
          Builder Options
        </button>
        <button className={activeTab === "orders" ? "active" : ""} onClick={() => setActiveTab("orders")}>
          Orders ({pendingOrders} pending)
        </button>
        <button className={activeTab === "dev" ? "active" : ""} onClick={() => setActiveTab("dev")}>
          RemiDev
        </button>
        <button onClick={loadAdminData}>Refresh</button>
        <button onClick={logout}>Logout</button>
      </div>

      {activeTab === "menu" && (
        <div className="admin-layout">
          <form className="admin-panel" onSubmit={saveMenuItem}>
            <h2>{menuForm.id ? "Edit menu bowl" : "Add menu bowl"}</h2>
            <label>
              Name
              <input value={menuForm.name} onChange={(event) => updateMenuForm("name", event.target.value)} />
            </label>
            <label>
              Description
              <textarea
                value={menuForm.description}
                onChange={(event) => updateMenuForm("description", event.target.value)}
              />
            </label>
            <div className="two-column-fields">
              <label>
                Price in PKR
                <input
                  type="number"
                  value={menuForm.price}
                  onChange={(event) => updateMenuForm("price", event.target.value)}
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={menuForm.sort_order}
                  onChange={(event) => updateMenuForm("sort_order", event.target.value)}
                />
              </label>
            </div>
            <label>
              Image URL
              <input value={menuForm.image} onChange={(event) => updateMenuForm("image", event.target.value)} />
            </label>
            <label>
              Tags
              <input
                value={menuForm.tags}
                onChange={(event) => updateMenuForm("tags", event.target.value)}
                placeholder="spicy, cozy, chicken"
              />
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={menuForm.is_available}
                onChange={(event) => updateMenuForm("is_available", event.target.checked)}
              />
              Show this item on public menu
            </label>
            <div className="admin-form-actions">
              <button className="primary-button">{menuForm.id ? "Update Bowl" : "Add Bowl"}</button>
              <button type="button" className="secondary-button" onClick={() => setMenuForm(emptyMenuForm)}>
                Clear
              </button>
            </div>
          </form>

          <div className="admin-panel admin-list-panel">
            <h2>Current menu</h2>
            <div className="admin-list admin-menu-list">
              {menuItems.map((item) => (
                <article className="admin-row" key={item.id}>
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatPrice(item.price)}</span>
                    <small>{item.is_available ? "Visible" : "Hidden"} - {item.tags.join(", ")}</small>
                  </div>
                  <div className="admin-row-actions">
                    <button className="small-button" onClick={() => editMenuItem(item)}>
                      Edit
                    </button>
                    <button className="text-button" onClick={() => toggleMenuVisibility(item)}>
                      {item.is_available ? "Hide" : "Unhide"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "toppings" && (
        <div className="admin-wide-layout">
          <form className="admin-panel admin-editor-panel" onSubmit={saveTopping}>
            <h2>{toppingForm.id ? "Edit topping" : "Add topping"}</h2>
            <label>
              Name
              <input value={toppingForm.name} onChange={(event) => updateToppingForm("name", event.target.value)} />
            </label>
            <div className="two-column-fields">
              <label>
                Price in PKR
                <input
                  type="number"
                  value={toppingForm.price}
                  onChange={(event) => updateToppingForm("price", event.target.value)}
                />
              </label>
              <label>
                Icon text
                <input
                  value={toppingForm.icon}
                  onChange={(event) => updateToppingForm("icon", event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={toppingForm.is_available}
                onChange={(event) => updateToppingForm("is_available", event.target.checked)}
              />
              Show this topping to customers
            </label>
            <div className="admin-form-actions">
              <button className="primary-button">{toppingForm.id ? "Update Topping" : "Add Topping"}</button>
              <button type="button" className="secondary-button" onClick={() => setToppingForm(emptyToppingForm)}>
                Clear
              </button>
            </div>
          </form>

          <div className="admin-panel admin-list-panel">
            <h2>Current toppings</h2>
            <div className="admin-list admin-card-list">
              {toppings.map((item) => (
                <article className="admin-row compact-row" key={item.id}>
                  <span className="admin-item-icon">{getToppingIcon(item)}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatPrice(item.price)}</span>
                    <small>{item.is_available ? "Visible" : "Hidden"}</small>
                  </div>
                  <div className="admin-row-actions">
                    <button className="small-button" onClick={() => editTopping(item)}>
                      Edit
                    </button>
                    <button className="text-button" onClick={() => toggleToppingVisibility(item)}>
                      {item.is_available ? "Hide" : "Unhide"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "options" && (
        <div className="admin-wide-layout">
          <form className="admin-panel admin-editor-panel" onSubmit={saveCustomOption}>
            <h2>{customOptionForm.id ? "Edit builder option" : "Add builder option"}</h2>
            <div className="two-column-fields">
              <label>
                Category
                <select
                  value={customOptionForm.category}
                  onChange={(event) => updateCustomOptionForm("category", event.target.value)}
                >
                  {customOptionCategories.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Price in PKR
                <input
                  type="number"
                  value={customOptionForm.price}
                  onChange={(event) => updateCustomOptionForm("price", event.target.value)}
                />
              </label>
            </div>
            <label>
              Name
              <input
                value={customOptionForm.name}
                onChange={(event) => updateCustomOptionForm("name", event.target.value)}
                placeholder="Example: Shoyu Broth"
              />
            </label>
            <label>
              Short note
              <input
                value={customOptionForm.note}
                onChange={(event) => updateCustomOptionForm("note", event.target.value)}
                placeholder="Example: soy-based and balanced"
              />
            </label>
            <div className="two-column-fields">
              <label>
                Icon text
                <input
                  value={customOptionForm.icon}
                  onChange={(event) => updateCustomOptionForm("icon", event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={customOptionForm.sort_order}
                  onChange={(event) => updateCustomOptionForm("sort_order", event.target.value)}
                />
              </label>
            </div>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={customOptionForm.is_available}
                onChange={(event) => updateCustomOptionForm("is_available", event.target.checked)}
              />
              Show this option in Build Your Bowl
            </label>
            <div className="admin-form-actions">
              <button className="primary-button">{customOptionForm.id ? "Update Option" : "Add Option"}</button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCustomOptionForm(emptyCustomOptionForm)}
              >
                Clear
              </button>
            </div>
          </form>

          <div className="admin-panel admin-list-panel">
            <h2>Current builder options</h2>
            <div className="admin-list admin-card-list">
              {customOptions.map((item) => (
                <article className="admin-row compact-row" key={item.id}>
                  <span className="admin-item-icon">{getCustomOptionIcon(item)}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{categoryName(item.category)} - {formatPrice(item.price)}</span>
                    <small>{item.is_available ? "Visible" : "Hidden"} - {item.note || "No note"}</small>
                  </div>
                  <div className="admin-row-actions">
                    <button className="small-button" onClick={() => editCustomOption(item)}>
                      Edit
                    </button>
                    <button className="text-button" onClick={() => toggleCustomOptionVisibility(item)}>
                      {item.is_available ? "Hide" : "Unhide"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "dev" && (
        <div className="remidev-page">
          <div className="remidev-hero-panel">
            <div className="remidev-stage">
              <div className="remi-character big remidev-character" aria-hidden="true">
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
              <div className="dance-tagline remidev-tagline">
                <strong>Meet RemiDev</strong>
                <span>Safe changes only. Preview first, confirm later.</span>
              </div>
            </div>

            <div className="remidev-hero-copy">
              <p className="eyebrow">Developer assistant page</p>
              <h1>RemiDev</h1>
              <p>
                Hi, I'm RemiDev — your Developer Assistant for safe menu, topping, setting and order updates.
              </p>
              <div className="remidev-capability-grid">
                <span>Menu tools</span>
                <span>Topping tools</span>
                <span>Order status</span>
                <span>Theme settings</span>
              </div>
            </div>
          </div>

          <div className="remidev-workspace">
            <div className="admin-panel remidev-panel">
    

              <div className="remidev-quick-prompts">
                <button type="button" onClick={() => setDevInput("Change Korean Fire Ramen price to 1200.")}>
                  Price update
                </button>
                <button type="button" onClick={() => setDevInput("Add Garlic Butter topping for 150.")}>
                  Add topping
                </button>
                <button type="button" onClick={() => setDevInput("Change tagline to Warm bowls for cozy cravings.")}>
                  Tagline
                </button>
                <button type="button" onClick={() => setDevInput("Change theme color to #B94A2F.")}>
                  Theme color
                </button>
              </div>

              <div className="remidev-chat">
                {devMessages.map((chatMessage, index) => (
                  <div
                    className={chatMessage.sender === "user" ? "remidev-message user" : "remidev-message assistant"}
                    key={`${chatMessage.sender}-${index}`}
                  >
                    <strong>{chatMessage.sender === "user" ? "You" : "RemiDev"}</strong>
                    <p>{chatMessage.text}</p>
                  </div>
                ))}
              </div>

              {pendingDevAction && (
                <div className="remidev-preview">
                  <p className="eyebrow">Preview before applying</p>
                  <strong>{pendingDevAction.tool}</strong>
                  <small>{JSON.stringify(pendingDevAction.arguments)}</small>
                  <div className="admin-form-actions">
                    <button className="primary-button" onClick={confirmDevAction} disabled={devLoading}>
                      Confirm
                    </button>
                    <button className="secondary-button" onClick={cancelDevAction} disabled={devLoading}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {lastUndoLog && (
                <div className="remidev-undo-card">
                  <div>
                    <strong>Change applied successfully.</strong>
                    <span>Undo this change?</span>
                  </div>
                  <button className="secondary-button" onClick={() => rollbackLog(lastUndoLog.id)} disabled={devLoading}>
                    Undo
                  </button>
                </div>
              )}

              <form className="remidev-form" onSubmit={sendDevCommand}>
                <input
                  value={devInput}
                  onChange={(event) => setDevInput(event.target.value)}
                  placeholder="Example: Change Korean Fire Ramen price to 1200."
                />
                <button className="primary-button" disabled={devLoading}>
                  {devLoading ? "Thinking..." : "Ask RemiDev"}
                </button>
              </form>

              <div className="remidev-safety-card">
                <strong>Safe update flow</strong>
                <span>1. RemiDev understands the command.</span>
                <span>2. You review the preview before anything changes.</span>
                <span>3. Confirmed updates are saved in Supabase and logged for rollback.</span>
              </div>
            </div>

            <div className="admin-panel remidev-log-panel">
              <h2>Recent admin logs</h2>
              <div className="admin-log-list">
                {adminLogs.length === 0 && <p>No RemiDev actions logged yet.</p>}
                {adminLogs.map((log) => (
                  <article className="admin-log-card" key={log.id}>
                    <div className="admin-log-main">
                      <div className="admin-log-heading">
                        <strong>{formatActionName(log.actionType)}</strong>
                        <span>{log.status || "success"}</span>
                      </div>
                      <div className="admin-log-details">
                        <p>
                          <span>Admin:</span>
                          {log.adminName || "Admin"}
                        </p>
                        <p>
                          <span>Action:</span>
                          {log.actionType}
                        </p>
                        <p>
                          <span>Target:</span>
                          {getLogTarget(log)}
                        </p>
                        <p>
                          <span>Old value:</span>
                          {formatLogValue(log, log.oldValue)}
                        </p>
                        <p>
                          <span>New value:</span>
                          {formatLogValue(log, log.newValue)}
                        </p>
                        <p>
                          <span>Time:</span>
                          {formatLogTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button className="text-button" onClick={() => rollbackLog(log.id)} disabled={devLoading}>
                      Undo
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="admin-panel admin-orders-panel">
          <h2>Orders</h2>
          <div className="admin-order-list">
            {orders.length === 0 && <p>No orders yet. Place a mock order from checkout to see it here.</p>}
            {orders.map((order) => (
              <article className="admin-order-card" key={order.id}>
                <div>
                  <p className="eyebrow">{order.orderNumber}</p>
                  <h3>{order.orderData?.name || "Ramen order"}</h3>
                  <p>
                    <strong>{order.customerName}</strong> - {order.phone}
                  </p>
                  <p>{order.address}</p>
                  {order.deliveryNote && <p>Note: {order.deliveryNote}</p>}
                  <p>Placed: {formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <strong>{formatPrice(order.total)}</strong>
                  <label>
                    Status
                    <select
                      value={order.status}
                      onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                    >
                      {orderStatuses.map((statusValue) => (
                        <option value={statusValue} key={statusValue}>
                          {statusValue}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
