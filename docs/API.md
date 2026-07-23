# REST API

All voice endpoints require:

```text
Authorization: Bearer <VOICE_API_TOKEN>
```

## Read

- `GET /api/v1/voice/products/search?q=...&branch_code=ALKHARJ`
- `GET /api/v1/voice/products/:code`
- `GET /api/v1/voice/categories`
- `GET /api/v1/voice/branches`
- `GET /api/v1/voice/branches/:code`
- `GET /api/v1/voice/policies?key=pricing`

## Optional write

Requires `ENABLE_WRITE_TOOLS=true`:

- `POST /api/v1/voice/service-requests`
- `POST /api/v1/voice/order-drafts`

## Admin

Requires:

```text
Authorization: Bearer <ADMIN_API_TOKEN>
```

- `GET /api/v1/admin/products`
- `PUT /api/v1/admin/products/:code`
- `POST /api/v1/admin/products/:code/aliases`
- `GET /api/v1/admin/branches`
- `PUT /api/v1/admin/branches/:code`
- `GET /api/v1/admin/service-requests`
- `GET /api/v1/admin/order-drafts`
- `GET /api/v1/admin/tool-audit`


## Official links

```http
GET /api/v1/voice/links
GET /api/v1/voice/links?type=official_hub
```

Returns only active links stored in the database. The official Perla hub is seeded as `https://beacons.ai/perlapastry`.
