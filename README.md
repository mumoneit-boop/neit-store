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

This is a local starter backend, not a production checkout. It does not process payments, send email, or include authentication, rate limiting, or production hosting configuration. Do not expose it publicly without adding those protections.
