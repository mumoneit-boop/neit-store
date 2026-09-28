# Neit Accessories

## Run locally

Requires Python 3.10 or newer. From this folder, start the site and API with:

```powershell
python server.py
```

Open http://127.0.0.1:8000. The server creates `storefront.sqlite3` in this folder for newsletter subscribers and orders.

## API

- `GET /api/health` reports server status.
- `GET /api/products` returns the product catalog.
- `POST /api/newsletter` accepts `{"email":"person@example.com"}` and saves the address.
- `POST /api/orders` accepts a name, email, and product IDs with quantities. Prices are looked up on the server. Orders are stored as `pending_payment`.
- `POST /api/bookings` accepts a name, email, date, time, and optional note for a styling appointment.
- `POST /api/payments` accepts an order ID plus either a test card number or Kenyan M-Pesa phone number, then marks a pending order as `paid`. Payment credentials are validated but never stored.

The storefront includes hash-routed booking and payment pages. M-Pesa is represented as a local demo STK-push flow; connect Safaricom Daraja credentials and callbacks before using it for real payments. This is a local starter backend, not a production checkout. It does not process real payments, send email, or include authentication, rate limiting, or production hosting configuration. Do not expose it publicly without adding those protections.
