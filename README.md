# Hubigo

Mobile-first PWA for professional cleaning and maintenance teams operating apartments in Dubai.

## Features

- **Roles:** Cleaner and Coordinator with role-based access.
- **Cleaner app:** Today's tasks, apartment history, task steps, comments, before/after photos, offline support.
- **Coordinator panel:** team board, apartments, users, task creation, CSV import, Hostfully integration, audit logs.
- **Authentication:** Email/phone + password, OTP login, session cookies, Argon2 hashing.
- **PWA:** Manifest, service worker, offline caching, installability.
- **Real-time:** Coordinator dashboard polls every 5 seconds for task updates.
- **Notifications:** Web Push subscription support, local reminders.
- **Hostfully integration:** Webhook/API sync architecture with idempotency and sync status tracking.

## Tech Stack

- Next.js 16 + App Router + TypeScript
- Tailwind CSS + shadcn/ui components
- PostgreSQL + Prisma ORM
- Argon2 + jose sessions
- S3-compatible storage abstraction
- Web Push
- Docker Compose

## Local Development

### 1. Clone and install

```bash
cd cleaning-app-hubigo
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

At minimum set:

```env
DATABASE_URL="postgresql://hubigo:hubigo@localhost:5432/hubigo?schema=public"
AUTH_SECRET="your-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

### 3. Start database

```bash
docker compose up -d postgres
```

### 4. Run migrations and seed

```bash
npm run db:migrate:dev
npm run db:seed
```

### 5. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo credentials

| Role        | Email                    | Password   |
| ----------- | ------------------------ | ---------- |
| Coordinator | coordinator@hubigo.local | Hubigo123! |
| Cleaner     | cleaner1@hubigo.local    | Hubigo123! |
| Cleaner     | cleaner2@hubigo.local    | Hubigo123! |

## Docker Compose (full stack)

```bash
docker compose up -d
```

This starts PostgreSQL and the Next.js app, runs migrations, and seeds the database.

## Production deployment

`docker-compose.prod.yml` runs three services on a VPS: `postgres` (internal only, no host port), `migrate` (one-shot `prisma migrate deploy`), and `app` (Next.js standalone, published on `127.0.0.1:APP_PORT` only). Uploads live in the named volume `hubigo-uploads`, served through an authenticated route at `/uploads/<key>`. It is designed to coexist with other dockerized apps on the same host — nothing is bound to a public interface.

### 1. Clone and configure

```bash
git clone <repo-url> cleaning-app-hubigo
cd cleaning-app-hubigo
cp .env.example .env
```

Mandatory values in `.env`:

```env
# openssl rand -base64 32
AUTH_SECRET="<generated>"
POSTGRES_PASSWORD="<generated>"
NEXT_PUBLIC_APP_URL="https://cleaning.loadly.pl"
APP_PORT="3100"
```

`AUTH_SECRET` is required in production — the app refuses to boot without it.

### 2. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The `migrate` service runs `prisma migrate deploy` and exits; `app` starts only after migrations succeed.

> **Note:** the dev Compose stack seeds demo data; the prod stack does **not**. The demo accounts (`coordinator@hubigo.local`, etc.) do not exist in production.

### 3. Create the first admin

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e ADMIN_NAME="Admin" \
  -e ADMIN_EMAIL="admin@example.com" \
  -e ADMIN_PASSWORD="<at least 10 chars>" \
  migrate npx tsx scripts/create-admin.ts
```

### 4. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### 5. Backup

```bash
docker exec hubigo-postgres pg_dump -U hubigo hubigo > backup.sql
```

The uploads volume can be archived with `docker run --rm -v hubigo_hubigo-uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tar.gz -C /data .` (adjust the volume name to your Compose project name).

### 6. Reverse proxy

#### Nginx

```nginx
server {
    server_name cleaning.loadly.pl;
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then issue a certificate: `sudo certbot --nginx -d cleaning.loadly.pl`.

#### Caddy

```caddy
cleaning.loadly.pl {
    request_body {
        max_size 12MB
    }
    reverse_proxy 127.0.0.1:3100
}
```

Caddy obtains and renews the TLS certificate automatically.

## Hostfully integration

Hubigo integrates with Hostfully via their official API v3.

### Configuration

Set these environment variables:

```env
HOSTFULLY_API_KEY="your-api-key"
HOSTFULLY_AGENCY_UID="your-agency-uid"
HOSTFULLY_API_BASE_URL="https://api.hostfully.com/api/v3.3"
HOSTFULLY_WEBHOOK_SECRET="random-secret-for-callback-token"
```

Get your API key and agency UID from Agency Settings in Hostfully. The integration uses header `X-HOSTFULLY-APIKEY` and API v3.3 (for the sandbox use `HOSTFULLY_API_BASE_URL="https://sandbox-api.hostfully.com/api/v3.3"`).

### Webhook setup

Hostfully sends no signature header, so the callback URL carries a shared secret: `/api/hostfully/webhook?token=<HOSTFULLY_WEBHOOK_SECRET>`. Webhooks are registered automatically — in the coordinator UI go to **Coordinator → Settings → Integrations → Register webhooks**, or call:

```bash
curl -X POST https://your-domain/api/coordinator/integrations/hostfully/webhooks \
  -H "Cookie: hubigo_session=..."
```

This creates one webhook per event type (`NEW_BOOKING`, `BOOKING_UPDATED`, `BOOKING_CANCELLED`, `LEAD_DATES_CHANGED`, `LEAD_PROPERTY_CHANGED`, `LEAD_SOFT_DELETED`, `NEW_PROPERTY`, `UPDATED_PROPERTY`, `ACTIVATED_PROPERTY`, `DEACTIVATED_PROPERTY`, `DELETED_PROPERTY`), skipping any already registered.

The handler verifies the `?token=` against `HOSTFULLY_WEBHOOK_SECRET`, checks `agency_uid` matches `HOSTFULLY_AGENCY_UID`, records a sync event, and normalizes reservations into Hubigo apartments and cleaning tasks.

### Manual sync fallback

Coordinators can trigger a manual sync from **Coordinator → Hostfully** or by calling:

```bash
curl -X POST https://your-domain/api/hostfully/sync \
  -H "Cookie: hubigo_session=..."
```

### Idempotency

Hostfully reservations are matched by `externalHostfullyReservationId`. Duplicate deliveries and repeated syncs will update existing tasks instead of creating new ones.

## Storage

Development uses local filesystem (`public/uploads`).

Production set `STORAGE_PROVIDER=s3` and configure `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`.

## Testing

```bash
# Unit / integration tests
npm run test

# End-to-end tests (requires dev server)
npm run dev
npx playwright test
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:migrate
npm run db:migrate:dev
npm run db:seed
npm run db:studio
npm run test
npm run test:e2e
```

## License

Internal use only.
