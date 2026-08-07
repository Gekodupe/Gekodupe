# Get an API key

Keys are created in the product UI. There is no self-serve key mint for guests.

## Steps

1. Sign in on **Account**
2. Verify your email if prompted
3. Open **API**
4. Enter a label (for example `Production`)
5. Click **Create key**
6. Copy the secret immediately

The full secret is shown once. After that you only see a prefix.

## Key shape

```
gd_live_<hex>
```

Send it as:

```
Authorization: Bearer gd_live_...
```

## Limits

| Plan | Max keys | API requests / day |
|------|----------|--------------------|
| Free | 3 | 1,500 |
| Starter | 5 | 25,000 |
| Pro | 10 | 200,000 |

Quota is shared across all keys on the account.

## Revoke

On the API tab, click **Revoke** next to a key. Apps using that secret stop working immediately. Create a replacement key before revoking production keys when possible.

## Usage charts

The API tab shows:

- Today vs daily quota
- Last 7 days of request volume

Usage updates as your servers call `/v1/spam/*` and `/v1/events/check`.
