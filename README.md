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

1. Set `NODE_ENV=production` and all S3/Hostfully/Web Push env vars.
2. Build and run the production Dockerfile:

```bash
docker build --target runner -t hubigo .
docker run -p 3000:3000 --env-file .env hubigo
```

3. Use a reverse proxy (e.g. Nginx/Caddy) with HTTPS for PWA and web push to work.

## Hostfully integration

Hubigo integrates with Hostfully via their official API v3.

### Configuration

Set these environment variables:

```env
HOSTFULLY_API_KEY="your-api-key"
HOSTFULLY_API_BASE_URL="https://api.hostfully.com/v2"
HOSTFULLY_WEBHOOK_SECRET="random-secret-for-signature-verification"
```

Get your API key from Agency Settings in Hostfully. The integration uses header `X-HOSTFULLY-APIKEY`.

### Webhook setup

Register a webhook in Hostfully pointing to:

```
https://your-domain/api/hostfully/webhook
```

Subscribe to these event types:

- `NEW_BOOKING`
- `BOOKING_UPDATED`
- `BOOKING_CANCELLED`
- `NEW_PROPERTY`
- `UPDATED_PROPERTY`
- `ACTIVATED_PROPERTY`
- `DEACTIVATED_PROPERTY`

The webhook handler verifies signatures when `HOSTFULLY_WEBHOOK_SECRET` is set, records sync events, and normalizes reservations into Hubigo apartments and cleaning tasks.

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
