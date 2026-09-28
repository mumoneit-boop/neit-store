import json
import re
import sqlite3
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from uuid import uuid4


ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "storefront.sqlite3"
HOST = "127.0.0.1"
PORT = 8000

PRODUCTS = [
    {"id": 1, "name": "The Sunday Hoops", "category": "Earrings", "price": 38, "detail": "Gold-plated · A little everyday shine", "tag": "Bestseller", "image": "photo-1617038220319-276d3cfab638"},
    {"id": 2, "name": "Pearl of a Moment", "category": "Necklaces", "price": 52, "detail": "Freshwater pearl · 18 in chain", "tag": "New", "image": "photo-1611652022419-a9419f74343d"},
    {"id": 3, "name": "A Little Signet", "category": "Rings", "price": 44, "detail": "Recycled brass · Adjustable", "tag": "Just in", "image": "photo-1605100804763-247f67b3557e"},
    {"id": 4, "name": "Golden Hour Cuff", "category": "Bracelets", "price": 48, "detail": "Sculptural gold · One size", "tag": "", "image": "photo-1611591437281-460bfbe1220a"},
    {"id": 5, "name": "The Daydream Drops", "category": "Earrings", "price": 42, "detail": "Gold vermeil · Lightweight", "tag": "New", "image": "photo-1535632066927-ab7c9ab60908"},
    {"id": 6, "name": "Little Orbit Pendant", "category": "Necklaces", "price": 56, "detail": "Gold-plated · 16 in + extender", "tag": "", "image": "photo-1611085583191-a3b181a88401"},
    {"id": 7, "name": "Twist & Shout", "category": "Rings", "price": 36, "detail": "Textured gold · Stackable", "tag": "Bestseller", "image": "photo-1603561596112-0a132b757442"},
    {"id": 8, "name": "The Nice One", "category": "Bracelets", "price": 50, "detail": "Mixed metal · Easy clasp", "tag": "", "image": "photo-1611652022419-a9419f74343d"},
]
PRODUCT_BY_ID = {product["id"]: product for product in PRODUCTS}


def initialize_database():
    with sqlite3.connect(DATABASE) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                email TEXT NOT NULL,
                total_cents INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY,
                order_id TEXT NOT NULL REFERENCES orders(id),
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                unit_price_cents INTEGER NOT NULL,
                quantity INTEGER NOT NULL
            );
            """
        )


class StoreHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 16_384:
            raise ValueError("Invalid request body")
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        if self.path == "/api/products":
            return self.send_json(200, {"products": PRODUCTS})
        if self.path == "/api/health":
            return self.send_json(200, {"ok": True})
        if self.path.startswith("/api/"):
            return self.send_json(404, {"error": "Not found"})
        return super().do_GET()

    def do_POST(self):
        try:
            payload = self.read_json()
            if self.path == "/api/newsletter":
                return self.subscribe(payload)
            if self.path == "/api/orders":
                return self.create_order(payload)
            return self.send_json(404, {"error": "Not found"})
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            return self.send_json(400, {"error": "Invalid request"})

    def subscribe(self, payload):
        email = str(payload.get("email", "")).strip().lower()
        if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            return self.send_json(400, {"error": "Enter a valid email address"})
        with sqlite3.connect(DATABASE) as connection:
            connection.execute(
                "INSERT OR IGNORE INTO subscribers (email, created_at) VALUES (?, ?)",
                (email, datetime.now(timezone.utc).isoformat()),
            )
        return self.send_json(201, {"ok": True, "message": "You're on the list."})

    def create_order(self, payload):
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        items = payload.get("items")
        if not name or len(name) > 120:
            return self.send_json(400, {"error": "Enter your name"})
        if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            return self.send_json(400, {"error": "Enter a valid email address"})
        if not isinstance(items, list) or not items or len(items) > len(PRODUCTS):
            return self.send_json(400, {"error": "Your bag is empty or invalid"})

        normalized = {}
        for item in items:
            if not isinstance(item, dict):
                return self.send_json(400, {"error": "Invalid item in bag"})
            product_id = item.get("productId")
            quantity = item.get("quantity")
            if (not isinstance(product_id, int) or product_id not in PRODUCT_BY_ID
                    or not isinstance(quantity, int) or isinstance(quantity, bool)
                    or quantity < 1 or quantity > 20):
                return self.send_json(400, {"error": "Invalid item in bag"})
            normalized[product_id] = normalized.get(product_id, 0) + quantity
            if normalized[product_id] > 20:
                return self.send_json(400, {"error": "Quantity limit exceeded"})

        order_id = uuid4().hex[:12].upper()
        total_cents = sum(PRODUCT_BY_ID[product_id]["price"] * 100 * quantity
                          for product_id, quantity in normalized.items())
        created_at = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(DATABASE) as connection:
            connection.execute(
                "INSERT INTO orders (id, customer_name, email, total_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (order_id, name, email, total_cents, "pending_payment", created_at),
            )
            connection.executemany(
                "INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?)",
                [(order_id, product_id, PRODUCT_BY_ID[product_id]["name"],
                  PRODUCT_BY_ID[product_id]["price"] * 100, quantity)
                 for product_id, quantity in normalized.items()],
            )
        return self.send_json(201, {
            "orderId": order_id,
            "status": "pending_payment",
            "total": total_cents / 100,
        })

    def log_message(self, format_string, *args):
        print("%s - %s" % (self.address_string(), format_string % args))


if __name__ == "__main__":
    initialize_database()
    server = ThreadingHTTPServer((HOST, PORT), StoreHandler)
    print(f"Neit backend ready at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    finally:
        server.server_close()