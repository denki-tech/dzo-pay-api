# D-ZO Pay API Documentation

## Base URL
- Development: `http://localhost:5000/api/v1`
- Production: `https://api.dzo-pay.com/api/v1`

## Authentication

### JWT Authentication
Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### API Key Authentication
Include your API key in the X-API-Key header:
```
X-API-Key: dzp_live_xxxxxxxx
```

### Admin Authentication
Admin endpoints require both a Bearer token and X-Admin-Key:
```
Authorization: Bearer <admin_token>
X-Admin-Key: <admin_secret>
```

## Rate Limiting
Rate limits are applied per API key or user plan:
- Free: 60 requests/minute, 500/hour, 2000/day
- Basic: 120 requests/minute, 2000/hour, 10000/day
- Pro: 300 requests/minute, 10000/hour, 50000/day
- Enterprise: 1000 requests/minute, 50000/hour, 200000/day

## Response Format
All responses follow this structure:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "errors": null
}
```

## Error Handling
Error responses include:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

## Idempotency
For payment operations, include an idempotency key:
```
Idempotency-Key: <unique-key>
```
Responses are cached for 24 hours.

## Webhooks
### Paystack Webhook
Endpoint: `POST /api/v1/webhooks/paystack`
Signature verification using X-Paystack-Signature header.

### Stripe Webhook
Endpoint: `POST /api/v1/webhooks/stripe`
Signature verification using Stripe-Signature header.

### Flutterwave Webhook
Endpoint: `POST /api/v1/webhooks/flutterwave`
Signature verification using Verif-Hash header.

## Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login user |
| POST | /auth/refresh-token | Refresh access token |
| GET | /auth/profile | Get user profile |
| PATCH | /auth/profile | Update profile |
| POST | /auth/change-password | Change password |
| POST | /auth/logout | Logout user |
| POST | /auth/mfa/setup | Setup MFA |
| POST | /auth/mfa/verify-setup | Verify MFA setup |
| POST | /auth/mfa/disable | Disable MFA |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /payments/initialize | Initialize payment |
| POST | /payments/verify/:reference | Verify payment |
| POST | /payments/links | Create payment link |
| GET | /payments/links | List payment links |
| GET | /payments/links/:slug | Get payment link |
| POST | /payments/links/:slug/pay | Pay via link |
| POST | /payments/refund | Process refund |
| GET | /payments/history | Transaction history |
| GET | /payments/history/:id | Transaction details |
| GET | /payments/stats | Payment statistics |
| GET | /payments/receipt/:id | Get receipt |

### Wallets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /wallets | List wallets |
| POST | /wallets | Create wallet |
| GET | /wallets/:id | Wallet details |
| PATCH | /wallets/:id | Update wallet |
| POST | /wallets/transfer | Transfer funds |
| POST | /wallets/:id/freeze | Freeze wallet |
| POST | /wallets/:id/unfreeze | Unfreeze wallet |
| GET | /wallets/:id/transactions | Wallet transactions |
| POST | /wallets/:id/default | Set default |

### Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /subscriptions/plans | List plans |
| GET | /subscriptions | Current subscription |
| POST | /subscriptions | Create subscription |
| POST | /subscriptions/upgrade | Upgrade plan |
| POST | /subscriptions/cancel | Cancel subscription |
| POST | /subscriptions/renew | Renew subscription |
| POST | /subscriptions/coupon | Apply coupon |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/users | List users |
| GET | /admin/users/:id | User details |
| PATCH | /admin/users/:id/status | Update status |
| POST | /admin/users/:id/impersonate | Impersonate user |
| GET | /admin/stats | Dashboard stats |
| GET | /admin/health | System health |
| GET | /admin/audit-logs | Audit logs |
| GET | /admin/webhook-logs | Webhook logs |
| GET | /admin/feature-flags | Feature flags |
| POST | /admin/feature-flags | Create flag |
| PATCH | /admin/feature-flags/:key | Toggle flag |
| GET | /admin/delivery-stats | Delivery stats |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /analytics/dashboard | Dashboard |
| GET | /analytics/transactions | Transaction analytics |
| GET | /analytics/users | User analytics |
| GET | /analytics/revenue | Revenue analytics |
| GET | /analytics/webhooks | Webhook analytics |
| GET | /analytics/realtime | Real-time stats |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Basic health |
| GET | /health/detailed | Detailed health |

## Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 429: Too Many Requests
- 500: Internal Server Error
- 503: Service Unavailable

## Currency Support
Supported currencies: NGN, USD, GHS, KES, ZAR, EUR, GBP

Default currency: NGN
