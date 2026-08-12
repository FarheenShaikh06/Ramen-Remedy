import hmac
import json
import os
import re
from datetime import datetime, timezone
from random import randint

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from supabase import create_client
except ImportError:
    create_client = None


app = Flask(__name__)
CORS(app)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
try:
    OPENAI_TIMEOUT_SECONDS = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "6"))
except ValueError:
    OPENAI_TIMEOUT_SECONDS = 6
REMI_FAST_MODE = os.getenv("REMI_FAST_MODE", "true").lower() != "false"
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = (
    os.getenv("SUPABASE_SECRET_KEY", "")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    or os.getenv("SUPABASE_SERVICE_KEY", "")
)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ramen-admin")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "ramen-remedy-local-admin-token")


CUSTOM_OPTION_CATEGORIES = ["broth", "noodle", "protein", "spice"]
DEFAULT_MENU_IMAGE_URL = "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=900&q=80"
THEME_COLOR_NAMES = {
    "warm orange": "#D85D32",
    "orange": "#D85D32",
    "soft red": "#B94A2F",
    "red": "#B94A2F",
    "brown": "#3A1F14",
    "cream": "#FFF3E4",
    "beige": "#F6E3C2",
}


supabase = None
if create_client and SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as error:
        print("Supabase connection error:", error)
        supabase = None


def using_supabase():
    return supabase is not None


def database_unavailable_message(action):
    if create_client is None:
        return "Supabase package is not installed. Run pip install -r requirements.txt, then restart Flask."

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return "Supabase is not configured. Check SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env."

    return "Supabase is not reachable while trying to " + action + ". Check your internet, keys, and table setup."


def format_money(amount):
    return "PKR " + str(amount)


def safe_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def slugify(text):
    cleaned = []
    last_was_dash = False

    for character in text.lower().strip():
        if character.isalnum():
            cleaned.append(character)
            last_was_dash = False
        elif not last_was_dash:
            cleaned.append("-")
            last_was_dash = True

    return "".join(cleaned).strip("-") or "item-" + str(randint(1000, 9999))


def parse_tags(value):
    if isinstance(value, list):
        return [str(tag).strip() for tag in value if str(tag).strip()]

    if isinstance(value, str):
        return [tag.strip() for tag in value.split(",") if tag.strip()]

    return []


def normalize_menu_item(row):
    tags = parse_tags(row.get("tags", []))
    price = row.get("price")

    if price is None:
        price = row.get("price_pkr", 0)

    return {
        "id": row.get("id"),
        "name": row.get("name", ""),
        "description": row.get("description", ""),
        "price": safe_int(price, 0),
        "image": row.get("image") or row.get("image_url", ""),
        "tags": tags,
        "is_available": bool(row.get("is_available", True)),
        "sort_order": safe_int(row.get("sort_order", 0), 0),
    }


def normalize_topping(row):
    price = row.get("price")

    if price is None:
        price = row.get("price_pkr", 0)

    return {
        "id": row.get("id"),
        "name": row.get("name", ""),
        "price": safe_int(price, 0),
        "icon": row.get("icon", ""),
        "is_available": bool(row.get("is_available", True)),
    }


def normalize_custom_option(row):
    price = row.get("price")

    if price is None:
        price = row.get("price_pkr", 0)

    return {
        "id": row.get("id"),
        "category": row.get("category", ""),
        "name": row.get("name", ""),
        "note": row.get("note", ""),
        "price": safe_int(price, 0),
        "icon": row.get("icon", ""),
        "is_available": bool(row.get("is_available", True)),
        "sort_order": safe_int(row.get("sort_order", 99), 99),
    }


def normalize_order(row):
    return {
        "id": row.get("id"),
        "orderNumber": row.get("order_number"),
        "customerName": row.get("customer_name"),
        "phone": row.get("phone"),
        "address": row.get("address"),
        "deliveryNote": row.get("delivery_note", ""),
        "paymentMethod": row.get("payment_method", "Cash on Delivery"),
        "total": safe_int(row.get("total_pkr", 0), 0),
        "status": row.get("status", "pending"),
        "orderData": row.get("order_data", {}),
        "createdAt": row.get("created_at", ""),
    }


def get_menu_items(include_unavailable=False):
    if not using_supabase():
        raise RuntimeError(database_unavailable_message("load menu items"))

    try:
        query = supabase.table("menu_items").select("*")
        if not include_unavailable:
            query = query.eq("is_available", True)
        response = query.order("sort_order").execute()
        return [normalize_menu_item(item) for item in response.data]
    except Exception as error:
        raise RuntimeError("Supabase menu fetch error: " + str(error))


def get_toppings_data(include_unavailable=False):
    if not using_supabase():
        raise RuntimeError(database_unavailable_message("load toppings"))

    try:
        query = supabase.table("toppings").select("*")
        if not include_unavailable:
            query = query.eq("is_available", True)
        response = query.order("name").execute()
        return [normalize_topping(item) for item in response.data]
    except Exception as error:
        raise RuntimeError("Supabase toppings fetch error: " + str(error))


def get_custom_options(include_unavailable=False):
    if not using_supabase():
        raise RuntimeError(database_unavailable_message("load custom builder options"))

    try:
        query = supabase.table("custom_options").select("*")
        if not include_unavailable:
            query = query.eq("is_available", True)
        response = query.execute()
        options = [normalize_custom_option(item) for item in response.data]
        return sorted(
            options,
            key=lambda item: (
                CUSTOM_OPTION_CATEGORIES.index(item["category"])
                if item["category"] in CUSTOM_OPTION_CATEGORIES
                else 99,
                item["sort_order"],
                item["name"],
            ),
        )
    except Exception as error:
        raise RuntimeError("Supabase custom options fetch error: " + str(error))


def group_custom_options(options=None):
    grouped_options = {category: [] for category in CUSTOM_OPTION_CATEGORIES}

    if options is None:
        options = get_custom_options()

    for option in options:
        category = option.get("category", "")
        if category in grouped_options:
            grouped_options[category].append(option)

    return grouped_options


def get_orders_data():
    if not using_supabase():
        raise RuntimeError(database_unavailable_message("load orders"))

    try:
        response = supabase.table("orders").select("*").order("created_at", desc=True).execute()
        return [normalize_order(order) for order in response.data]
    except Exception as error:
        raise RuntimeError("Supabase orders fetch error: " + str(error))


def get_topping_price(topping_id):
    for topping in get_toppings_data():
        if topping["id"] == topping_id:
            return topping["price"]
    return 0


def get_custom_option_price(options, category, option_id):
    for option in options:
        if option["category"] == category and option["id"] == option_id:
            return option["price"]

    raise RuntimeError(
        "The "
        + category
        + " option '"
        + str(option_id)
        + "' is not available in Supabase."
    )


def calculate_custom_price(order_data):
    broth = order_data.get("broth", "")
    noodle = order_data.get("noodle", "")
    protein = order_data.get("protein", "")
    spice_level = order_data.get("spiceLevel", "")
    selected_toppings = order_data.get("toppings", [])
    quantity = safe_int(order_data.get("quantity", 1), 1)

    if quantity < 1:
        quantity = 1

    custom_options = get_custom_options()
    base_price = get_custom_option_price(custom_options, "broth", broth)
    base_price += get_custom_option_price(custom_options, "noodle", noodle)
    base_price += get_custom_option_price(custom_options, "protein", protein)
    base_price += get_custom_option_price(custom_options, "spice", spice_level)

    toppings_total = 0
    for topping_id in selected_toppings:
        toppings_total += get_topping_price(topping_id)

    price_per_bowl = base_price + toppings_total
    total = price_per_bowl * quantity

    return {
        "base_price": round(base_price, 2),
        "toppings_total": round(toppings_total, 2),
        "price_per_bowl": round(price_per_bowl, 2),
        "quantity": quantity,
        "total": round(total, 2),
    }


def friendly_topping_icon(name):
    lower_name = str(name or "").lower()
    icon_rules = [
        ("garlic butter", "\U0001f9c8"),
        ("butter", "\U0001f9c8"),
        ("garlic", "\U0001f9c4"),
        ("egg", "\U0001f95a"),
        ("corn", "\U0001f33d"),
        ("mushroom", "\U0001f344"),
        ("chicken", "\U0001f357"),
        ("cheese", "\U0001f9c0"),
        ("seaweed", "\U0001f33f"),
        ("chili", "\U0001f336\ufe0f"),
        ("spring onion", "\U0001f957"),
        ("onion", "\U0001f957"),
        ("tofu", "\u25fb\ufe0f"),
        ("shrimp", "\U0001f990"),
        ("prawn", "\U0001f990"),
    ]

    for keyword, icon in icon_rules:
        if keyword in lower_name:
            return icon

    return "\U0001f35c"


def default_menu_description(name):
    return (
        str(name or "This ramen")
        + " is a fresh cozy ramen bowl added from the admin dashboard."
    )


def menu_payload(data, existing_id=None):
    name = str(data.get("name", "")).strip()
    item_id = existing_id or str(data.get("id", "")).strip() or slugify(name)
    description = str(data.get("description", "")).strip()
    image_url = str(data.get("image", data.get("image_url", ""))).strip()
    tags = parse_tags(data.get("tags", []))

    return {
        "id": item_id,
        "name": name,
        "description": description or default_menu_description(name),
        "price_pkr": safe_int(data.get("price", data.get("price_pkr", 0)), 0),
        "image_url": image_url or DEFAULT_MENU_IMAGE_URL,
        "tags": tags or ["cozy", "ramen"],
        "is_available": bool(data.get("is_available", True)),
        "sort_order": safe_int(data.get("sort_order", 99), 99),
    }


def topping_payload(data, existing_id=None):
    name = str(data.get("name", "")).strip()
    topping_id = existing_id or str(data.get("id", "")).strip() or slugify(name)
    icon = str(data.get("icon", "")).strip()

    return {
        "id": topping_id,
        "name": name,
        "price_pkr": safe_int(data.get("price", data.get("price_pkr", 0)), 0),
        "icon": icon or friendly_topping_icon(name),
        "is_available": bool(data.get("is_available", True)),
    }


def custom_option_payload(data, existing_id=None):
    name = str(data.get("name", "")).strip()
    option_id = existing_id or str(data.get("id", "")).strip() or slugify(name)
    category = str(data.get("category", "")).strip().lower()

    return {
        "id": option_id,
        "category": category,
        "name": name,
        "note": str(data.get("note", "")).strip(),
        "price_pkr": safe_int(data.get("price", data.get("price_pkr", 0)), 0),
        "icon": str(data.get("icon", "")).strip(),
        "is_available": bool(data.get("is_available", True)),
        "sort_order": safe_int(data.get("sort_order", 99), 99),
    }


def upsert_menu_item(data, existing_id=None):
    payload = menu_payload(data, existing_id)

    if payload["name"] == "":
        return None, "Menu item name is required."

    if payload["price_pkr"] < 1:
        return None, "Menu item price must be greater than 0."

    if not using_supabase():
        return None, database_unavailable_message("save a menu item")

    try:
        response = supabase.table("menu_items").upsert(payload).execute()
        row = response.data[0] if response.data else payload
        return normalize_menu_item(row), None
    except Exception as error:
        return None, "Supabase menu save error: " + str(error)


def upsert_topping(data, existing_id=None):
    payload = topping_payload(data, existing_id)

    if payload["name"] == "":
        return None, "Topping name is required."

    if payload["price_pkr"] < 0:
        return None, "Topping price cannot be negative."

    if not using_supabase():
        return None, database_unavailable_message("save a topping")

    try:
        response = supabase.table("toppings").upsert(payload).execute()
        row = response.data[0] if response.data else payload
        return normalize_topping(row), None
    except Exception as error:
        return None, "Supabase topping save error: " + str(error)


def upsert_custom_option(data, existing_id=None):
    payload = custom_option_payload(data, existing_id)

    if payload["name"] == "":
        return None, "Custom option name is required."

    if payload["category"] not in CUSTOM_OPTION_CATEGORIES:
        return None, "Choose a valid category: broth, noodle, protein, or spice."

    if payload["price_pkr"] < 0:
        return None, "Custom option price cannot be negative."

    if not using_supabase():
        return None, database_unavailable_message("save a custom builder option")

    try:
        response = supabase.table("custom_options").upsert(payload).execute()
        row = response.data[0] if response.data else payload
        return normalize_custom_option(row), None
    except Exception as error:
        return None, "Supabase custom option save error: " + str(error)


def mark_menu_unavailable(item_id):
    if not using_supabase():
        return False, database_unavailable_message("hide a menu item")

    try:
        supabase.table("menu_items").update({"is_available": False}).eq("id", item_id).execute()
        return True, None
    except Exception as error:
        return False, "Supabase menu delete error: " + str(error)


def mark_topping_unavailable(topping_id):
    if not using_supabase():
        return False, database_unavailable_message("hide a topping")

    try:
        supabase.table("toppings").update({"is_available": False}).eq("id", topping_id).execute()
        return True, None
    except Exception as error:
        return False, "Supabase topping delete error: " + str(error)


def mark_custom_option_unavailable(option_id):
    if not using_supabase():
        return False, database_unavailable_message("hide a custom builder option")

    try:
        supabase.table("custom_options").update({"is_available": False}).eq("id", option_id).execute()
        return True, None
    except Exception as error:
        return False, "Supabase custom option delete error: " + str(error)


def save_order(order_number, customer, order):
    total = safe_int(order.get("total", 0), 0)
    payload = {
        "id": order_number,
        "order_number": order_number,
        "customer_name": customer.get("name", ""),
        "phone": customer.get("phone", ""),
        "address": customer.get("address", ""),
        "delivery_note": customer.get("note", ""),
        "payment_method": order.get("paymentMethod", "Cash on Delivery"),
        "total_pkr": total,
        "status": "pending",
        "order_data": order,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if not using_supabase():
        return None, database_unavailable_message("save an order")

    try:
        response = supabase.table("orders").insert(payload).execute()
        row = response.data[0] if response.data else payload
        return normalize_order(row), None
    except Exception as error:
        return None, "Supabase order insert error: " + str(error)


def update_order_status(order_id, status):
    allowed_statuses = ["pending", "preparing", "out for delivery", "delivered", "cancelled"]

    if status not in allowed_statuses:
        return None, "Please choose a valid order status."

    if not using_supabase():
        return None, database_unavailable_message("update an order")

    try:
        response = supabase.table("orders").update({"status": status}).eq("id", order_id).execute()
        row = response.data[0] if response.data else {"id": order_id, "status": status}
        return normalize_order(row), None
    except Exception as error:
        return None, "Supabase order status error: " + str(error)


def normalize_admin_log(row):
    return {
        "id": row.get("id"),
        "adminName": row.get("admin_name", "Admin"),
        "actionType": row.get("action_type", ""),
        "targetTable": row.get("target_table", ""),
        "targetId": row.get("target_id", ""),
        "oldValue": row.get("old_value"),
        "newValue": row.get("new_value"),
        "status": row.get("status", "success"),
        "createdAt": row.get("created_at", ""),
    }


def make_log_id():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    return "log-" + stamp + "-" + str(randint(1000, 9999))


def get_site_settings():
    default_settings = {
        "primary_color": "#B94A2F",
        "secondary_color": "#FFF3E4",
        "logo_url": "",
        "tagline": "A bowl that feels like home.",
        "hero_title": "Ramen Remedy",
        "delivery_fee": "150",
    }

    if not using_supabase():
        return default_settings

    try:
        response = supabase.table("site_settings").select("*").execute()
        settings = default_settings.copy()
        for row in response.data:
            settings[row.get("setting_key", "")] = row.get("setting_value", "")
        return settings
    except Exception as error:
        print("Supabase settings fetch error:", error)
        return default_settings


def update_site_setting(setting_key, setting_value):
    allowed_settings = [
        "primary_color",
        "secondary_color",
        "logo_url",
        "tagline",
        "hero_title",
        "delivery_fee",
    ]

    if setting_key not in allowed_settings:
        return None, None, "That setting is not allowed."

    if not using_supabase():
        return None, None, database_unavailable_message("update site settings")

    old_response = supabase.table("site_settings").select("*").eq("setting_key", setting_key).execute()
    old_row = old_response.data[0] if old_response.data else None

    payload = {
        "id": "setting-" + setting_key.replace("_", "-"),
        "setting_key": setting_key,
        "setting_value": str(setting_value),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    response = supabase.table("site_settings").upsert(payload).execute()
    new_row = response.data[0] if response.data else payload
    return old_row, new_row, None


def get_admin_logs(limit=20):
    if not using_supabase():
        raise RuntimeError(database_unavailable_message("load admin logs"))

    try:
        response = supabase.table("admin_logs").select("*").order("created_at", desc=True).limit(limit).execute()
        return [normalize_admin_log(row) for row in response.data]
    except Exception as error:
        raise RuntimeError("Supabase admin logs fetch error: " + str(error))


def write_admin_log(action_type, target_table, target_id, old_value, new_value, status="success"):
    if not using_supabase():
        return None

    payload = {
        "id": make_log_id(),
        "admin_name": os.getenv("ADMIN_NAME", "Admin"),
        "action_type": action_type,
        "target_table": target_table,
        "target_id": target_id,
        "old_value": old_value,
        "new_value": new_value,
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        response = supabase.table("admin_logs").insert(payload).execute()
        row = response.data[0] if response.data else payload
        return normalize_admin_log(row)
    except Exception as error:
        print("Admin log insert error:", error)
        return None


def find_menu_item(item_name_or_id):
    search_value = str(item_name_or_id or "").strip().lower()
    if search_value == "":
        return None

    search_slug = slugify(search_value)

    for item in get_menu_items(include_unavailable=True):
        item_name = item["name"].lower()
        item_slug = slugify(item["name"])

        if item["id"].lower() == search_value or item["id"].lower() == search_slug:
            return item

        if item_name == search_value or item_slug == search_slug:
            return item

    for item in get_menu_items(include_unavailable=True):
        item_name = item["name"].lower()
        item_slug = slugify(item["name"])

        if search_value in item_name or item_name in search_value:
            return item

        if search_slug in item_slug or item_slug in search_slug:
            return item

    return None


def find_topping(topping_name_or_id):
    search_value = str(topping_name_or_id or "").strip().lower()
    if search_value == "":
        return None

    search_slug = slugify(search_value)

    for item in get_toppings_data(include_unavailable=True):
        item_name = item["name"].lower()
        item_slug = slugify(item["name"])

        if item["id"].lower() == search_value or item["id"].lower() == search_slug:
            return item

        if item_name == search_value or item_slug == search_slug:
            return item

    for item in get_toppings_data(include_unavailable=True):
        item_name = item["name"].lower()
        item_slug = slugify(item["name"])

        if search_value in item_name or item_name in search_value:
            return item

        if search_slug in item_slug or item_slug in search_slug:
            return item

    return None


def find_available_topping(topping_name_or_id):
    topping = find_topping(topping_name_or_id)

    if topping and topping.get("is_available") is False:
        return None, "I found " + topping["name"] + ", but it is already hidden from customers."

    if not topping:
        return None, "I could not find that topping. Check spelling or add it first."

    return topping, None


def find_order(order_id):
    search_value = str(order_id or "").strip().lower()
    if search_value == "":
        return None

    for order in get_orders_data():
        order_number = str(order.get("orderNumber", "")).lower()
        real_id = str(order.get("id", "")).lower()
        if search_value in [order_number, real_id] or order_number.endswith(search_value):
            return order

    return None


def number_from_text(text):
    match = re.search(r"(?i)(?:pkr|rs\.?|rupees)?\s*(\d+)", str(text or ""))
    if match:
        return safe_int(match.group(1), 0)
    return 0


def number_from_value(value):
    if isinstance(value, (int, float)):
        return safe_int(value, 0)
    return number_from_text(str(value or ""))


def text_after_keyword(text, keyword):
    match = re.search(r"(?i)\b" + re.escape(keyword) + r"\b\s*(.+)$", str(text or ""))
    if not match:
        return ""
    return match.group(1).strip(" .:")


def remove_price_phrases(text):
    name = str(text or "")
    name = re.sub(r"(?i)\b(for|at|to|is|price is|price to|costs?)\s*(pkr|rs\.?|rupees)?\s*\d+\b.*", "", name)
    name = re.sub(r"(?i)\b(pkr|rs\.?|rupees)\s*\d+\b.*", "", name)
    name = re.sub(r"\d+.*", "", name)
    return name


def clean_name_fragment(text, words_to_remove=None):
    name = remove_price_phrases(text)
    words_to_remove = words_to_remove or []

    for word in sorted(words_to_remove, key=len, reverse=True):
        name = re.sub(r"(?i)\b" + re.escape(word) + r"\b", " ", name)

    name = re.sub(r"(?i)\b(from|for|at|please|the|system|permanently|kindly)\b", " ", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip(" .:-")


def name_before_price(text, words_to_remove=None):
    return clean_name_fragment(text, words_to_remove)


def name_after_action_word(text):
    return clean_name_fragment(
        text,
        [
            "remove",
            "delete",
            "hide",
            "mark",
            "make",
            "unavailable",
            "menu item",
            "menu",
            "item",
            "add on",
            "addon",
            "addons",
            "add-on",
            "add-ons",
            "topping",
            "toppings",
        ],
    )


def color_from_text(text):
    match = re.search(r"#[0-9a-fA-F]{6}", str(text or ""))
    if match:
        return match.group(0)

    lower_text = str(text or "").lower()
    for color_name, color_value in THEME_COLOR_NAMES.items():
        if color_name in lower_text:
            return color_value

    return text_after_keyword(text, "to")


def url_from_text(text):
    match = re.search(r"https?://\S+", str(text or ""))
    if match:
        return match.group(0).strip(" .,)")
    return text_after_keyword(text, "to")


def extract_add_topping_name(text):
    patterns = [
        r"(?i)\badd\s+(.+?)\s+toppings?\b",
        r"(?i)\bcreate\s+(.+?)\s+toppings?\b",
        r"(?i)\bnew\s+toppings?\s+(.+)$",
        r"(?i)\badd\s+toppings?\s+(.+)$",
    ]

    for pattern in patterns:
        match = re.search(pattern, remove_price_phrases(text))
        if match:
            return clean_name_fragment(match.group(1), ["topping", "toppings"])

    return clean_name_fragment(text, ["add", "create", "new", "topping", "toppings"])


def extract_add_menu_name(text):
    base = remove_price_phrases(text)
    patterns = [
        r"(?i)\badd\s+(?:new\s+)?(?:menu item|ramen bowl|ramen|bowl)\s+(.+)$",
        r"(?i)\badd\s+(.+?)\s+(?:to\s+)?(?:menu|public menu)\b",
        r"(?i)\bcreate\s+(?:new\s+)?(?:menu item|ramen bowl|ramen|bowl)\s+(.+)$",
    ]

    for pattern in patterns:
        match = re.search(pattern, base)
        if match:
            return clean_name_fragment(match.group(1), ["called", "named"])

    return clean_name_fragment(base, ["add", "create", "new", "menu item", "menu", "bowl"])


def extract_description_update(text):
    patterns = [
        r"(?i)\bdescription\s+(?:of|for)\s+(.+?)\s+to\s+(.+)$",
        r"(?i)\bchange\s+(.+?)\s+description\s+to\s+(.+)$",
        r"(?i)\bupdate\s+(.+?)\s+description\s+to\s+(.+)$",
    ]

    for pattern in patterns:
        match = re.search(pattern, str(text or ""))
        if match:
            return clean_name_fragment(match.group(1)), match.group(2).strip(" .")

    return "", ""


def simple_dev_action_from_message(message):
    text = str(message or "").strip()
    lower_text = text.lower()

    if lower_text in ["undo", "rollback", "undo last", "undo last change", "rollback last change"]:
        return {"tool": "rollback_previous_change", "arguments": {}}

    if ("show" in lower_text or "list" in lower_text or "view" in lower_text) and "menu" in lower_text:
        return {"tool": "get_menu_items", "arguments": {}}

    if "recent order" in lower_text or (("show" in lower_text or "list" in lower_text or "view" in lower_text) and "order" in lower_text):
        return {"tool": "view_recent_orders", "arguments": {}}

    if "tagline" in lower_text:
        return {"tool": "change_tagline", "arguments": {"new_tagline": text_after_keyword(text, "to")}}

    if "logo" in lower_text:
        return {"tool": "change_logo_url", "arguments": {"logo_url": url_from_text(text)}}

    if "theme" in lower_text or "color" in lower_text or "colour" in lower_text:
        return {"tool": "change_theme_color", "arguments": {"primary_color": color_from_text(text)}}

    if "delivery fee" in lower_text or "delivery charge" in lower_text:
        return {"tool": "update_delivery_fee", "arguments": {"delivery_fee": number_from_text(text)}}

    if "order" in lower_text and any(status in lower_text for status in ["pending", "preparing", "out for delivery", "delivered", "cancelled"]):
        status = "delivered"
        for status_option in ["out for delivery", "pending", "preparing", "delivered", "cancelled"]:
            if status_option in lower_text:
                status = status_option
                break
        return {"tool": "update_order_status", "arguments": {"order_id": str(number_from_text(text)), "status": status}}

    if "description" in lower_text and " to " in lower_text:
        item_name, description = extract_description_update(text)
        return {
            "tool": "update_menu_description",
            "arguments": {"item_name": item_name, "new_description": description},
        }

    if ("add" in lower_text or "create" in lower_text or "new" in lower_text) and "topping" in lower_text:
        name_part = extract_add_topping_name(text)
        return {
            "tool": "add_topping",
            "arguments": {"name": name_part, "price": number_from_text(text), "icon": friendly_topping_icon(name_part)},
        }

    if ("add" in lower_text or "create" in lower_text or "new" in lower_text) and any(word in lower_text for word in ["menu", "ramen", "bowl"]):
        name_part = extract_add_menu_name(text)
        return {"tool": "add_menu_item", "arguments": {"name": name_part, "price": number_from_text(text)}}

    if re.search(r"(?i)\bfor\s+(pkr|rs\.?|rupees)?\s*\d+\s*(rs\.?|pkr|rupees)?\b", text) and "order" not in lower_text:
        name_part = extract_add_topping_name(text)
        return {
            "tool": "add_topping",
            "arguments": {"name": name_part, "price": number_from_text(text), "icon": friendly_topping_icon(name_part)},
        }

    if "price" in lower_text or "cost" in lower_text or re.search(r"(?i)\bto\s+(pkr|rs\.?|rupees)?\s*\d+\b", text):
        words_to_remove = ["change", "update", "set", "make", "price", "cost", "of", "to", "rs", "pkr", "rupees"]
        if "topping" in lower_text:
            name_part = name_before_price(text, words_to_remove + ["topping", "toppings"])
            return {"tool": "update_topping_price", "arguments": {"topping_name": name_part, "new_price": number_from_text(text)}}

        name_part = name_before_price(text, words_to_remove)
        try:
            if find_topping(name_part):
                return {"tool": "update_topping_price", "arguments": {"topping_name": name_part, "new_price": number_from_text(text)}}
            if find_menu_item(name_part):
                return {"tool": "update_menu_price", "arguments": {"item_name": name_part, "new_price": number_from_text(text)}}
        except RuntimeError:
            pass

        if "ramen" in lower_text or "menu" in lower_text or "bowl" in lower_text:
            return {"tool": "update_menu_price", "arguments": {"item_name": name_part, "new_price": number_from_text(text)}}

    if ("remove" in lower_text or "delete" in lower_text) and "topping" in lower_text:
        return {"tool": "delete_topping", "arguments": {"topping_name": name_after_action_word(text)}}

    if "remove" in lower_text or "delete" in lower_text:
        name_part = name_after_action_word(text)
        if "menu" in lower_text or "ramen" in lower_text or "bowl" in lower_text:
            return {"tool": "delete_menu_item", "arguments": {"item_name": name_part}}
        try:
            if find_topping(name_part):
                return {"tool": "delete_topping", "arguments": {"topping_name": name_part}}
            if find_menu_item(name_part):
                return {"tool": "delete_menu_item", "arguments": {"item_name": name_part}}
        except RuntimeError:
            pass
        return {"tool": "delete_topping", "arguments": {"topping_name": name_part}}

    if "unavailable" in lower_text or "hide" in lower_text:
        return {"tool": "mark_menu_item_unavailable", "arguments": {"item_name": name_after_action_word(text)}}

    return None


def ai_dev_action_from_message(message):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        return None

    prompt = """
You are RemiDev, an admin-only assistant for a ramen website.
Return only JSON. Do not return markdown.
Allowed tools:
get_menu_items, add_menu_item, update_menu_price, update_menu_description,
delete_menu_item, mark_menu_item_unavailable, add_topping, update_topping_price,
delete_topping, update_order_status, change_theme_color, change_logo_url,
change_tagline, update_delivery_fee, view_recent_orders, rollback_previous_change.

JSON shape:
{"tool":"tool_name","arguments":{}}

Use keys such as item_name, new_price, new_description, name, price,
topping_name, order_id, status, primary_color, logo_url, new_tagline,
delivery_fee.
"""

    try:
        client = OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "developer", "content": prompt},
                {"role": "user", "content": str(message)},
            ],
        )
        action = json.loads(response.output_text.strip())
        if isinstance(action, dict):
            return action
    except Exception as error:
        print("OpenAI RemiDev parse error:", error)

    return None


ALLOWED_DEV_TOOLS = [
    "get_menu_items",
    "add_menu_item",
    "update_menu_price",
    "update_menu_description",
    "delete_menu_item",
    "mark_menu_item_unavailable",
    "add_topping",
    "update_topping_price",
    "delete_topping",
    "update_order_status",
    "change_theme_color",
    "change_logo_url",
    "change_tagline",
    "update_delivery_fee",
    "view_recent_orders",
    "rollback_previous_change",
]


def clean_dev_action(action):
    if not isinstance(action, dict):
        return None, "I could not understand that command."

    tool = str(action.get("tool", "")).strip()
    arguments = action.get("arguments", {})

    if tool not in ALLOWED_DEV_TOOLS:
        return None, "That RemiDev tool is not allowed."

    if not isinstance(arguments, dict):
        arguments = {}

    return {"tool": tool, "arguments": arguments}, None


def latest_rollback_candidate():
    for log in get_admin_logs(20):
        if not str(log.get("actionType", "")).startswith("rollback_"):
            return log
    return None


def prepare_dev_action(action):
    clean_action, error = clean_dev_action(action)
    if error:
        return None, None, error

    tool = clean_action["tool"]
    args = clean_action["arguments"]

    if tool == "get_menu_items":
        return "Here are the current menu items.", get_menu_items(include_unavailable=True), None

    if tool == "view_recent_orders":
        return "Here are the latest orders.", get_orders_data()[:8], None

    if tool == "rollback_previous_change":
        latest_log = latest_rollback_candidate()
        if not latest_log:
            return None, None, "There is no previous RemiDev action to roll back."
        clean_action["arguments"] = {"log_id": latest_log["id"]}
        return (
            "I can undo the latest action: "
            + latest_log["actionType"]
            + " on "
            + str(latest_log.get("targetId", "selected record"))
            + ". Confirm to roll it back.",
            clean_action,
            None,
        )

    if tool == "update_menu_price":
        item = find_menu_item(args.get("item_name") or args.get("item_id"))
        new_price = number_from_value(args.get("new_price") or args.get("price") or args.get("price_pkr"))
        if not item or new_price < 1:
            return None, None, "Please give a valid menu item and price."
        clean_action["arguments"] = {"item_id": item["id"], "item_name": item["name"], "new_price": new_price}
        return "I found " + item["name"] + ". Current price: " + format_money(item["price"]) + ". New price: " + format_money(new_price) + ". Confirm to apply.", clean_action, None

    if tool == "update_menu_description":
        item = find_menu_item(args.get("item_name") or args.get("item_id"))
        description = str(args.get("new_description", "")).strip()
        if not item or description == "":
            return None, None, "Please give a valid menu item and new description."
        clean_action["arguments"] = {"item_id": item["id"], "item_name": item["name"], "new_description": description}
        return "I found " + item["name"] + ". Confirm to update its description.", clean_action, None

    if tool == "delete_menu_item":
        item = find_menu_item(args.get("item_name") or args.get("item_id"))
        if not item:
            return None, None, "I could not find that menu item in Supabase."
        clean_action["arguments"] = {"item_id": item["id"], "item_name": item["name"]}
        return "I found " + item["name"] + ". Confirm to permanently delete it from the system.", clean_action, None

    if tool == "mark_menu_item_unavailable":
        item = find_menu_item(args.get("item_name") or args.get("item_id"))
        if not item:
            return None, None, "I could not find that menu item in Supabase."
        clean_action["arguments"] = {"item_id": item["id"], "item_name": item["name"]}
        return "I found " + item["name"] + ". Confirm to hide it from customers.", clean_action, None

    if tool == "add_menu_item":
        name = str(args.get("name", "")).strip()
        price = number_from_value(args.get("price") or args.get("price_pkr"))
        if name == "" or price < 1:
            return None, None, "Please give the new ramen name and price."
        clean_action["arguments"] = {
            "name": name,
            "description": str(args.get("description", "")).strip() or default_menu_description(name),
            "price": price,
            "image": str(args.get("image", "")).strip() or DEFAULT_MENU_IMAGE_URL,
            "tags": args.get("tags", []) or ["cozy", "ramen"],
            "is_available": True,
        }
        return "I can add " + name + " for " + format_money(price) + " and show it on the public menu. Confirm to add it.", clean_action, None

    if tool == "add_topping":
        name = str(args.get("name") or args.get("topping_name") or args.get("item_name") or "").strip()
        price = number_from_value(args.get("price") or args.get("new_price") or args.get("price_pkr"))
        if name == "" or price < 0:
            return None, None, "Please give the topping name and price."
        icon = str(args.get("icon", "")).strip() or friendly_topping_icon(name)
        clean_action["arguments"] = {"name": name, "price": price, "icon": icon, "is_available": True}
        return "I can add " + icon + " " + name + " for " + format_money(price) + " and show it to customers. Confirm to add it.", clean_action, None

    if tool == "update_topping_price":
        topping = find_topping(args.get("topping_name") or args.get("topping_id"))
        new_price = number_from_value(args.get("new_price") or args.get("price") or args.get("price_pkr"))
        if not topping or new_price < 0:
            return None, None, "Please give a valid topping and price."
        clean_action["arguments"] = {"topping_id": topping["id"], "topping_name": topping["name"], "new_price": new_price}
        return "I found " + topping["name"] + ". Current price: " + format_money(topping["price"]) + ". New price: " + format_money(new_price) + ". Confirm to apply.", clean_action, None

    if tool == "delete_topping":
        topping = find_topping(args.get("topping_name") or args.get("topping_id"))
        if not topping:
            return None, None, "I could not find that topping in Supabase."
        clean_action["arguments"] = {"topping_id": topping["id"], "topping_name": topping["name"]}
        return "I found " + topping["name"] + ". Confirm to permanently delete it from the system.", clean_action, None

    if tool == "update_order_status":
        order = find_order(args.get("order_id"))
        status = str(args.get("status", "")).strip().lower()
        if not order:
            return None, None, "Please give a valid order number."
        if status not in ["pending", "preparing", "out for delivery", "delivered", "cancelled"]:
            return None, None, "Please choose a valid order status."
        clean_action["arguments"] = {"order_id": order["id"], "status": status}
        return "I found order " + order["orderNumber"] + ". Confirm to mark it " + status + ".", clean_action, None

    if tool == "change_theme_color":
        color = str(args.get("primary_color", "")).strip()
        if not re.match(r"^#[0-9a-fA-F]{6}$", color):
            return None, None, "Please give a valid hex color like #B94A2F."
        clean_action["arguments"] = {"setting_key": "primary_color", "setting_value": color}
        return "Theme primary color will change to " + color + ". Confirm to apply.", clean_action, None

    if tool == "change_logo_url":
        logo_url = str(args.get("logo_url", "")).strip()
        if logo_url == "":
            return None, None, "Please give a valid logo URL."
        clean_action["arguments"] = {"setting_key": "logo_url", "setting_value": logo_url}
        return "Logo URL will be updated. Confirm to apply.", clean_action, None

    if tool == "change_tagline":
        tagline = str(args.get("new_tagline", "")).strip()
        if tagline == "":
            return None, None, "Please give the new tagline."
        clean_action["arguments"] = {"setting_key": "tagline", "setting_value": tagline}
        return "Tagline will become: " + tagline + ". Confirm to apply.", clean_action, None

    if tool == "update_delivery_fee":
        fee = number_from_value(args.get("delivery_fee") or args.get("fee") or args.get("setting_value"))
        if fee < 0:
            return None, None, "Delivery fee cannot be negative."
        clean_action["arguments"] = {"setting_key": "delivery_fee", "setting_value": str(fee)}
        return "Delivery fee will change to " + format_money(fee) + ". Confirm to apply.", clean_action, None

    return None, None, "That command is not supported yet."


def apply_dev_action(action):
    clean_action, error = clean_dev_action(action)
    if error:
        return None, error

    tool = clean_action["tool"]
    args = clean_action["arguments"]

    if not using_supabase():
        return None, database_unavailable_message("apply a RemiDev action")

    try:
        if tool == "update_menu_price":
            item_id = args.get("item_id")
            old_response = supabase.table("menu_items").select("*").eq("id", item_id).execute()
            old_row = old_response.data[0] if old_response.data else None
            if not old_row:
                return None, "Menu item not found."
            new_price = safe_int(args.get("new_price"), 0)
            response = supabase.table("menu_items").update({"price_pkr": new_price}).eq("id", item_id).execute()
            new_row = response.data[0] if response.data else {**old_row, "price_pkr": new_price}
            write_admin_log(tool, "menu_items", item_id, old_row, new_row)
            return normalize_menu_item(new_row), None

        if tool == "update_menu_description":
            item_id = args.get("item_id")
            old_response = supabase.table("menu_items").select("*").eq("id", item_id).execute()
            old_row = old_response.data[0] if old_response.data else None
            if not old_row:
                return None, "Menu item not found."
            description = str(args.get("new_description", "")).strip()
            response = supabase.table("menu_items").update({"description": description}).eq("id", item_id).execute()
            new_row = response.data[0] if response.data else {**old_row, "description": description}
            write_admin_log(tool, "menu_items", item_id, old_row, new_row)
            return normalize_menu_item(new_row), None

        if tool == "mark_menu_item_unavailable":
            item_id = args.get("item_id")
            old_response = supabase.table("menu_items").select("*").eq("id", item_id).execute()
            old_row = old_response.data[0] if old_response.data else None
            if not old_row:
                return None, "Menu item not found."
            response = supabase.table("menu_items").update({"is_available": False}).eq("id", item_id).execute()
            new_row = response.data[0] if response.data else {**old_row, "is_available": False}
            write_admin_log(tool, "menu_items", item_id, old_row, new_row)
            return normalize_menu_item(new_row), None

        if tool == "delete_menu_item":
            item_id = args.get("item_id")
            old_response = supabase.table("menu_items").select("*").eq("id", item_id).execute()
            old_row = old_response.data[0] if old_response.data else None
            if not old_row:
                return None, "Menu item not found."
            supabase.table("menu_items").delete().eq("id", item_id).execute()
            write_admin_log(tool, "menu_items", item_id, old_row, None)
            return normalize_menu_item(old_row), None

        if tool == "add_menu_item":
            saved_item, save_error = upsert_menu_item(args)
            if save_error:
                return None, save_error
            write_admin_log(tool, "menu_items", saved_item["id"], None, saved_item)
            return saved_item, None

        if tool == "add_topping":
            saved_topping, save_error = upsert_topping(args)
            if save_error:
                return None, save_error
            write_admin_log(tool, "toppings", saved_topping["id"], None, saved_topping)
            return saved_topping, None

        if tool == "update_topping_price":
            topping_id = args.get("topping_id")
            old_response = supabase.table("toppings").select("*").eq("id", topping_id).execute()
            old_row = old_response.data[0] if old_response.data else None
            if not old_row:
                return None, "Topping not found."
            new_price = safe_int(args.get("new_price"), 0)
            response = supabase.table("toppings").update({"price_pkr": new_price}).eq("id", topping_id).execute()
            new_row = response.data[0] if response.data else {**old_row, "price_pkr": new_price}
            write_admin_log(tool, "toppings", topping_id, old_row, new_row)
            return normalize_topping(new_row), None

        if tool == "delete_topping":
            topping_id = args.get("topping_id")
            old_response = supabase.table("toppings").select("*").eq("id", topping_id).execute()
            old_row = old_response.data[0] if old_response.data else None
            if not old_row:
                return None, "Topping not found."
            supabase.table("toppings").delete().eq("id", topping_id).execute()
            write_admin_log(tool, "toppings", topping_id, old_row, None)
            return normalize_topping(old_row), None

        if tool == "update_order_status":
            order_id = args.get("order_id")
            old_response = supabase.table("orders").select("*").eq("id", order_id).execute()
            old_row = old_response.data[0] if old_response.data else None
            updated_order, update_error = update_order_status(order_id, args.get("status"))
            if update_error:
                return None, update_error
            new_response = supabase.table("orders").select("*").eq("id", order_id).execute()
            new_row = new_response.data[0] if new_response.data else updated_order
            write_admin_log(tool, "orders", order_id, old_row, new_row)
            return updated_order, None

        if tool in ["change_theme_color", "change_logo_url", "change_tagline", "update_delivery_fee"]:
            setting_key = args.get("setting_key")
            setting_value = args.get("setting_value")
            old_row, new_row, setting_error = update_site_setting(setting_key, setting_value)
            if setting_error:
                return None, setting_error
            write_admin_log(tool, "site_settings", setting_key, old_row, new_row)
            return {"setting": setting_key, "value": setting_value}, None

        if tool == "rollback_previous_change":
            log_id = str(args.get("log_id", "")).strip()
            if log_id == "":
                return None, "No rollback log was selected."
            message = rollback_admin_log(log_id)
            return {"message": message}, None

        return None, "This action cannot be applied."
    except Exception as error:
        return None, "RemiDev action error: " + str(error)


def rollback_admin_log(log_id):
    if not using_supabase():
        return database_unavailable_message("rollback an admin action")

    response = supabase.table("admin_logs").select("*").eq("id", log_id).execute()
    if not response.data:
        return "Admin log not found."

    log = response.data[0]
    target_table = log.get("target_table")
    target_id = log.get("target_id")
    old_value = log.get("old_value")
    action_type = log.get("action_type")

    if old_value is None:
        if target_table in ["menu_items", "toppings"] and target_id:
            supabase.table(target_table).delete().eq("id", target_id).execute()
            write_admin_log("rollback_" + action_type, target_table, target_id, log.get("new_value"), None)
            return "Rollback applied by deleting the newly added item."
        return "This action cannot be rolled back automatically."

    if target_table == "site_settings":
        setting_key = old_value.get("setting_key")
        setting_value = old_value.get("setting_value", "")
        update_site_setting(setting_key, setting_value)
        write_admin_log("rollback_" + action_type, target_table, setting_key, log.get("new_value"), old_value)
        return "Setting rollback applied."

    if target_table in ["menu_items", "toppings", "orders"]:
        supabase.table(target_table).upsert(old_value).execute()
        write_admin_log("rollback_" + action_type, target_table, target_id, log.get("new_value"), old_value)
        return "Rollback applied successfully."

    return "This action cannot be rolled back automatically."


def admin_request_is_valid():
    header = request.headers.get("Authorization", "")
    token = header.replace("Bearer ", "").strip()
    return hmac.compare_digest(token, ADMIN_TOKEN)


def admin_error():
    if admin_request_is_valid():
        return None
    return jsonify({"error": "Admin login is required."}), 401


def menu_prompt_text():
    menu_lines = []
    try:
        for item in get_menu_items():
            menu_lines.append(
                "- "
                + item["name"]
                + " ("
                + format_money(item["price"])
                + "): "
                + item["description"]
            )
    except RuntimeError:
        return "The menu database is currently unavailable."
    return "\n".join(menu_lines)


def toppings_prompt_text():
    topping_lines = []
    try:
        for topping in get_toppings_data():
            topping_lines.append("- " + topping["name"] + ": +" + format_money(topping["price"]))
    except RuntimeError:
        return "The toppings database is currently unavailable."
    return "\n".join(topping_lines)


def custom_options_prompt_text():
    try:
        grouped_options = group_custom_options()
    except RuntimeError:
        return "The custom builder options database is currently unavailable."

    lines = []
    labels = {
        "broth": "Broths",
        "noodle": "Noodles",
        "protein": "Proteins",
        "spice": "Spice levels",
    }

    for category in CUSTOM_OPTION_CATEGORIES:
        option_text = []
        for option in grouped_options[category]:
            option_text.append(option["name"] + " (" + format_money(option["price"]) + ")")
        lines.append(labels[category] + ": " + ", ".join(option_text))

    return "\n".join(lines)


def build_remi_prompt():
    return """
You are Remi, the cozy ramen assistant for Ramen Remedy.

Your job:
- Help users choose ramen from the menu.
- Suggest custom bowl combinations using the available builder options.
- Explain toppings and prices in simple words.
- Answer delivery and payment questions for this mock student project.
- Sound warm, friendly, and human, but keep replies focused on ramen.

Important rules:
- Use PKR prices only.
- Payment is Cash on Delivery only.
- This is a mock order system, not a real payment or delivery system.
- If a user asks for something not priced in the builder, such as rice, say it is not a priced option yet. They can write it in special instructions, but the total will not update unless the restaurant adds it.
- If the user is unclear, ask one short follow-up question.
- Keep most replies between 2 and 5 sentences.
- Do not invent menu items outside the menu below.

Restaurant menu:
""" + menu_prompt_text() + """

Available toppings:
""" + toppings_prompt_text() + """

Custom builder options:
""" + custom_options_prompt_text()


def build_chat_history(history):
    chat_messages = []

    if not isinstance(history, list):
        return chat_messages

    recent_history = history[-8:]

    for item in recent_history:
        if not isinstance(item, dict):
            continue

        text = item.get("text", "")
        sender = item.get("sender", "")

        if not isinstance(text, str) or text.strip() == "":
            continue

        role = "assistant"
        if sender == "user":
            role = "user"

        chat_messages.append({"role": role, "content": text.strip()[:800]})

    return chat_messages


def ai_remi_reply(user_message, history):
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key or OpenAI is None:
        return None

    try:
        client = OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)
        messages = [{"role": "developer", "content": build_remi_prompt()}]
        messages.extend(build_chat_history(history))
        messages.append({"role": "user", "content": user_message})

        response = client.responses.create(
            model=OPENAI_MODEL,
            input=messages,
        )

        return response.output_text.strip()
    except Exception as error:
        print("OpenAI chatbot error:", error)
        return None


def remi_reply(user_message):
    message = user_message.lower()

    if "how are you" in message or "how're you" in message or "how r you" in message:
        return "I am cozy and ready to help. Tell me if you want something spicy, creamy, vegetarian, or classic, and I will suggest a bowl."

    if "rice" in message:
        return "Rice is not a priced builder option yet, so it will not change the total automatically. You can write it in special instructions, or the admin can add it later as a topping or builder option."

    if "custom" in message or "suggested bowl" in message or "custom bowl" in message or "options" in message:
        if "vegetarian" in message or "veggie" in message or "tofu" in message:
            return "Ready-made pick: Veggie Comfort Ramen. Custom bowl idea: veggie broth, classic noodles, tofu, mushrooms, corn, seaweed, spring onions, and mild chili oil."
        if "spicy" in message or "hot" in message or "fire" in message:
            return "Ready-made pick: Korean Fire Ramen. Custom bowl idea: miso broth, thick noodles, chicken, fire spice, chili oil, boiled egg, and spring onions."
        if "creamy" in message or "cheese" in message or "soft" in message:
            return "Ready-made pick: Creamy Cheese Ramen. Custom bowl idea: tonkotsu broth, classic noodles, chicken, cheese, corn, boiled egg, and mild spice."
        if "seafood" in message or "shrimp" in message:
            return "Ready-made pick: Seafood Ramen. Custom bowl idea: shoyu broth, thin noodles, shrimp, seaweed, mushrooms, spring onions, and medium spice."
        return "Ready-made pick: Spicy Miso Ramen. Custom bowl idea: miso broth, thick noodles, chicken or tofu, boiled egg, corn, mushrooms, and medium spice."

    if "spicy" in message or "hot" in message or "fire" in message or "heat" in message:
        return "You should try our Korean Fire Ramen with chili oil and a boiled egg. It is bold, spicy, and perfect for heat lovers."

    if "vegetarian" in message or "veggie" in message or "no meat" in message or "tofu" in message:
        return "Veggie Comfort Ramen would be perfect. Add mushrooms, tofu, corn, and spring onions for a cozy vegetarian bowl."

    if "topping" in message or "toppings" in message or "extra" in message:
        topping_names = []
        try:
            for topping in get_toppings_data():
                topping_names.append(topping["name"])
        except RuntimeError:
            return "I cannot read the toppings database right now. Please check the Supabase connection and try again."
        return "We offer " + ", ".join(topping_names) + ". My cozy favorite is boiled egg, mushrooms, and chili oil."

    if "delivery" in message or "address" in message or "home" in message or "doorstep" in message:
        return "This project uses a mock delivery system. You can enter your name, phone number, and address, then place a sample order for home delivery."

    if "cheese" in message or "creamy" in message or "soft" in message:
        return "Creamy Cheese Ramen is a soft, cozy choice. Add corn and spring onions if you want a little sweetness and freshness."

    if "seafood" in message or "shrimp" in message or "fish" in message:
        return "Seafood Ramen is the best pick for a savory ocean-style bowl. Seaweed and spring onions work beautifully with it."

    if "chicken" in message or "classic" in message or "safe" in message:
        return "Classic Chicken Ramen is a comforting choice if you want something familiar, warm, and filling."

    if "build" in message or "custom" in message or "make my own" in message:
        return "Try the Build Your Bowl section. Pick your broth, noodles, protein, spice level, toppings, and quantity, and I will help keep the total clear."

    if "hello" in message or "hi" in message or "hey" in message:
        return "Hi, I am Remi. Tell me what you are craving: spicy, creamy, vegetarian, classic, or seafood."

    return "I would suggest Spicy Miso Ramen if you want flavor with a gentle kick, or Classic Chicken Ramen if you want a warm comfort bowl."


def remi_can_answer_locally(user_message):
    message = user_message.lower()
    local_keywords = [
        "how are you",
        "how're you",
        "spicy",
        "hot",
        "fire",
        "vegetarian",
        "veggie",
        "tofu",
        "topping",
        "delivery",
        "address",
        "cheese",
        "creamy",
        "seafood",
        "shrimp",
        "chicken",
        "classic",
        "build",
        "custom",
        "rice",
        "hello",
        "hi",
        "hey",
    ]

    return any(keyword in message for keyword in local_keywords)


@app.route("/api/menu", methods=["GET"])
def get_menu():
    try:
        return jsonify(get_menu_items())
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 503


@app.route("/api/toppings", methods=["GET"])
def get_toppings():
    try:
        return jsonify(get_toppings_data())
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 503


@app.route("/api/custom-options", methods=["GET"])
def get_public_custom_options():
    try:
        return jsonify(group_custom_options())
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 503


@app.route("/api/settings", methods=["GET"])
def public_settings():
    return jsonify({"settings": get_site_settings()})


@app.route("/api/calculate-order", methods=["POST"])
def calculate_order():
    order_data = request.get_json() or {}
    try:
        price_details = calculate_custom_price(order_data)
        return jsonify(price_details)
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 503


@app.route("/api/place-order", methods=["POST"])
def place_order():
    order_data = request.get_json() or {}
    customer = order_data.get("customer", {})
    order = order_data.get("order", {})

    if not customer.get("name") or not customer.get("phone") or not customer.get("address"):
        return jsonify({"error": "Please add your name, phone number, and delivery address."}), 400

    order_number = "RR-" + str(randint(1000, 9999))
    stored_order, save_error = save_order(order_number, customer, order)

    if save_error:
        return jsonify({"error": save_error}), 500

    return jsonify(
        {
            "orderNumber": order_number,
            "message": "Order " + order_number + " is confirmed for " + customer["name"] + ". Payment method: Cash on Delivery. Your mock ramen delivery is being prepared with extra cozy energy.",
            "order": order,
            "customer": customer,
            "storedOrder": stored_order,
        }
    )


@app.route("/api/chatbot", methods=["POST"])
def chatbot():
    data = request.get_json() or {}
    user_message = data.get("message", "")
    history = data.get("history", [])

    if user_message.strip() == "":
        return jsonify({"reply": "Send me a craving and I will help you choose a bowl.", "mode": "empty"})

    if REMI_FAST_MODE and remi_can_answer_locally(user_message):
        return jsonify({"reply": remi_reply(user_message), "mode": "fast-rule-based"})

    ai_reply = ai_remi_reply(user_message, history)

    if ai_reply:
        return jsonify({"reply": ai_reply, "mode": "openai"})

    reply = remi_reply(user_message)
    return jsonify({"reply": reply, "mode": "rule-based"})


@app.route("/api/chatbot-status", methods=["GET"])
def chatbot_status():
    openai_ready = bool(os.getenv("OPENAI_API_KEY")) and OpenAI is not None
    return jsonify({"openaiReady": openai_ready, "model": OPENAI_MODEL})


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    password = str(data.get("password", ""))

    if hmac.compare_digest(password, ADMIN_PASSWORD):
        return jsonify({"token": ADMIN_TOKEN, "message": "Admin login successful."})

    return jsonify({"error": "Incorrect admin password."}), 401


@app.route("/api/admin/status", methods=["GET"])
def admin_status():
    error = admin_error()
    if error:
        return error

    try:
        return jsonify(
            {
                "databaseMode": "supabase" if using_supabase() else "not-connected",
                "supabaseConnected": using_supabase(),
                "menuCount": len(get_menu_items(include_unavailable=True)),
                "toppingCount": len(get_toppings_data(include_unavailable=True)),
                "customOptionCount": len(get_custom_options(include_unavailable=True)),
                "orderCount": len(get_orders_data()),
            }
        )
    except RuntimeError as error:
        return jsonify(
            {
                "databaseMode": "not-connected",
                "supabaseConnected": False,
                "menuCount": 0,
                "toppingCount": 0,
                "customOptionCount": 0,
                "orderCount": 0,
                "error": str(error),
            }
        ), 503


@app.route("/api/admin/menu", methods=["GET", "POST"])
def admin_menu():
    error = admin_error()
    if error:
        return error

    if request.method == "GET":
        try:
            return jsonify(get_menu_items(include_unavailable=True))
        except RuntimeError as database_error:
            return jsonify({"error": str(database_error)}), 503

    data = request.get_json() or {}
    saved_item, save_error = upsert_menu_item(data)

    if save_error:
        return jsonify({"error": save_error}), 400

    return jsonify(saved_item), 201


@app.route("/api/admin/menu/<item_id>", methods=["PUT", "DELETE"])
def admin_menu_item(item_id):
    error = admin_error()
    if error:
        return error

    if request.method == "DELETE":
        deleted, delete_error = mark_menu_unavailable(item_id)
        if delete_error:
            return jsonify({"error": delete_error}), 400
        return jsonify({"deleted": deleted, "id": item_id})

    data = request.get_json() or {}
    saved_item, save_error = upsert_menu_item(data, existing_id=item_id)

    if save_error:
        return jsonify({"error": save_error}), 400

    return jsonify(saved_item)


@app.route("/api/admin/toppings", methods=["GET", "POST"])
def admin_toppings():
    error = admin_error()
    if error:
        return error

    if request.method == "GET":
        try:
            return jsonify(get_toppings_data(include_unavailable=True))
        except RuntimeError as database_error:
            return jsonify({"error": str(database_error)}), 503

    data = request.get_json() or {}
    saved_topping, save_error = upsert_topping(data)

    if save_error:
        return jsonify({"error": save_error}), 400

    return jsonify(saved_topping), 201


@app.route("/api/admin/toppings/<topping_id>", methods=["PUT", "DELETE"])
def admin_topping_item(topping_id):
    error = admin_error()
    if error:
        return error

    if request.method == "DELETE":
        deleted, delete_error = mark_topping_unavailable(topping_id)
        if delete_error:
            return jsonify({"error": delete_error}), 400
        return jsonify({"deleted": deleted, "id": topping_id})

    data = request.get_json() or {}
    saved_topping, save_error = upsert_topping(data, existing_id=topping_id)

    if save_error:
        return jsonify({"error": save_error}), 400

    return jsonify(saved_topping)


@app.route("/api/admin/custom-options", methods=["GET", "POST"])
def admin_custom_options():
    error = admin_error()
    if error:
        return error

    if request.method == "GET":
        try:
            return jsonify(get_custom_options(include_unavailable=True))
        except RuntimeError as database_error:
            return jsonify({"error": str(database_error)}), 503

    data = request.get_json() or {}
    saved_option, save_error = upsert_custom_option(data)

    if save_error:
        return jsonify({"error": save_error}), 400

    return jsonify(saved_option), 201


@app.route("/api/admin/custom-options/<option_id>", methods=["PUT", "DELETE"])
def admin_custom_option_item(option_id):
    error = admin_error()
    if error:
        return error

    if request.method == "DELETE":
        deleted, delete_error = mark_custom_option_unavailable(option_id)
        if delete_error:
            return jsonify({"error": delete_error}), 400
        return jsonify({"deleted": deleted, "id": option_id})

    data = request.get_json() or {}
    saved_option, save_error = upsert_custom_option(data, existing_id=option_id)

    if save_error:
        return jsonify({"error": save_error}), 400

    return jsonify(saved_option)


@app.route("/api/admin/orders", methods=["GET"])
def admin_orders():
    error = admin_error()
    if error:
        return error

    try:
        return jsonify(get_orders_data())
    except RuntimeError as database_error:
        return jsonify({"error": str(database_error)}), 503


@app.route("/api/admin/orders/<order_id>/status", methods=["PATCH"])
def admin_order_status(order_id):
    error = admin_error()
    if error:
        return error

    data = request.get_json() or {}
    updated_order, update_error = update_order_status(order_id, data.get("status", "pending"))

    if update_error:
        return jsonify({"error": update_error}), 400

    return jsonify(updated_order)


@app.route("/api/admin/logs", methods=["GET"])
def admin_logs():
    error = admin_error()
    if error:
        return error

    try:
        return jsonify(get_admin_logs())
    except RuntimeError as log_error:
        return jsonify({"error": str(log_error)}), 503


@app.route("/api/admin/settings", methods=["PUT"])
def admin_settings():
    error = admin_error()
    if error:
        return error

    data = request.get_json() or {}
    setting_key = str(data.get("setting_key", "")).strip()
    setting_value = str(data.get("setting_value", "")).strip()

    try:
        old_row, new_row, setting_error = update_site_setting(setting_key, setting_value)
        if setting_error:
            return jsonify({"error": setting_error}), 400
        write_admin_log("update_setting", "site_settings", setting_key, old_row, new_row)
        return jsonify({"message": "Setting updated.", "settings": get_site_settings()})
    except Exception as setting_error:
        return jsonify({"error": "Settings update error: " + str(setting_error)}), 500


@app.route("/api/admin/dev-assistant", methods=["POST"])
def admin_dev_assistant():
    error = admin_error()
    if error:
        return error

    data = request.get_json() or {}
    message = str(data.get("message", "")).strip()

    if message == "":
        return jsonify({"error": "Please type a RemiDev command."}), 400

    action = simple_dev_action_from_message(message)
    if action is None:
        action = ai_dev_action_from_message(message)

    try:
        preview_message, prepared, prepare_error = prepare_dev_action(action)
    except RuntimeError as database_error:
        return jsonify({"error": str(database_error)}), 503

    if prepare_error:
        return jsonify({"error": prepare_error}), 400

    if prepared and isinstance(prepared, dict) and "tool" in prepared:
        return jsonify(
            {
                "message": preview_message,
                "needsConfirmation": True,
                "action": prepared,
            }
        )

    return jsonify(
        {
            "message": preview_message,
            "needsConfirmation": False,
            "result": prepared,
        }
    )


@app.route("/api/admin/confirm-action", methods=["POST"])
def admin_confirm_action():
    error = admin_error()
    if error:
        return error

    data = request.get_json() or {}
    action = data.get("action", {})
    result, action_error = apply_dev_action(action)

    if action_error:
        return jsonify({"error": action_error}), 400

    response_message = "Change applied successfully. Undo this change?"
    if isinstance(action, dict) and action.get("tool") == "rollback_previous_change":
        response_message = result.get("message", "Rollback applied successfully.") if isinstance(result, dict) else "Rollback applied successfully."

    latest_log = None
    try:
        latest_logs = get_admin_logs(1)
        if latest_logs:
            latest_log = latest_logs[0]
    except RuntimeError:
        latest_log = None

    return jsonify(
        {
            "message": response_message,
            "result": result,
            "log": latest_log,
        }
    )


@app.route("/api/admin/rollback", methods=["POST"])
def admin_rollback():
    error = admin_error()
    if error:
        return error

    data = request.get_json() or {}
    log_id = str(data.get("logId", "")).strip()

    if log_id == "":
        return jsonify({"error": "Log id is required for rollback."}), 400

    try:
        message = rollback_admin_log(log_id)
        return jsonify({"message": message})
    except Exception as rollback_error:
        return jsonify({"error": "Rollback error: " + str(rollback_error)}), 500


if __name__ == "__main__":
    app.run(debug=True)
