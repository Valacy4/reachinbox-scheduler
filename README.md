# ReachInbox Email Scheduler

A full-stack email scheduling service built for the ReachInbox.ai assignment. The app schedules email jobs using BullMQ delayed jobs backed by Redis, persists email state in PostgreSQL, sends test emails through Ethereal SMTP, and provides a Next.js dashboard for scheduling and monitoring emails.

## Tech Stack

### Backend

- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- BullMQ
- Redis
- Nodemailer
- Ethereal Email
- Multer
- Zod

### Frontend

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- NextAuth.js
- Google OAuth
- lucide-react icons

## Project Structure

```text
reachinbox-scheduler/
  backend/
    prisma/
    src/
      config/
      controllers/
      jobs/
      lib/
      middleware/
      routes/
      scripts/
      types/
  frontend/
    src/
      app/
      components/
      lib/
      types/
  docker-compose.yml
```

## Prerequisites

- Node.js 18+
- npm
- Docker Desktop
- Google Cloud OAuth credentials
- Ethereal Email test account

## 1. Start Docker Services

From the project root:

```powershell
docker compose up -d
```

This starts:

- PostgreSQL on port `5432`
- Redis on port `6379`

Check status:

```powershell
docker compose ps
```

## 2. Backend Setup

Go to the backend directory:

```powershell
cd backend
npm install
```

Create the backend env file:

```powershell
copy .env.example .env
```

Fill in `backend/.env`:

```env
DATABASE_URL="postgresql://reachinbox:reachinbox@localhost:5432/reachinbox_scheduler?schema=public"

REDIS_HOST=localhost
REDIS_PORT=6379

PORT=4000
FRONTEND_URL=http://localhost:3000

ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your-ethereal-user@ethereal.email
ETHEREAL_PASS=your-ethereal-password

WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200

GOOGLE_CLIENT_ID=your-google-client-id
```

Generate Prisma client:

```powershell
npm run prisma:generate
```

Run migrations:

```powershell
npm run prisma:migrate
```

## 3. Ethereal Email Setup

Generate an Ethereal test account and confirm SMTP works:

```powershell
npm run test:ethereal
```

The script prints an Ethereal `user` and `pass`.

Paste those values into `backend/.env`:

```env
ETHEREAL_USER=generated-user@ethereal.email
ETHEREAL_PASS=generated-password
```

Then seed the sender into the database:

```powershell
npx ts-node-dev --transpile-only src/scripts/seedSender.ts
```

The script prints the seeded sender ID. Use that ID in the frontend env as `NEXT_PUBLIC_DEFAULT_SENDER_ID`.

## 4. Run Backend API

In one terminal:

```powershell
cd backend
npm run dev
```

The backend runs on:

```text
http://localhost:4000
```

Health check:

```text
GET http://localhost:4000/health
```

## 5. Run BullMQ Worker

In a second terminal:

```powershell
cd backend
npm run worker
```

The worker processes delayed email jobs from Redis.

Worker behavior:

- Uses configurable concurrency from `WORKER_CONCURRENCY`
- Checks database status before sending
- Skips jobs already marked `sent`
- Sends using Ethereal SMTP
- Marks jobs as `sent` only after SMTP success
- Marks jobs as `failed` on send error
- Reschedules jobs when hourly rate limit is reached

## 6. Frontend Setup

Go to the frontend directory:

```powershell
cd frontend
npm install
```

Create the frontend env file:

```powershell
copy .env.local.example .env.local
```

Fill in `frontend/.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_DEFAULT_SENDER_ID=your-seeded-sender-id
```

Generate a NextAuth secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run the frontend:

```powershell
npm run dev
```

The frontend runs on:

```text
http://localhost:3000
```

## Google OAuth Setup

In Google Cloud Console:

1. Create or select a Google Cloud project.
2. Go to **APIs & Services > OAuth consent screen**.
3. Choose **External**.
4. Add app name, support email, and developer contact email.
5. Add your Gmail address as a test user.
6. Go to **APIs & Services > Credentials**.
7. Create OAuth Client ID.
8. Choose application type: **Web application**.
9. Add authorized JavaScript origin:

```text
http://localhost:3000
```

10. Add authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

11. Copy the Client ID and Client Secret into `frontend/.env.local`.
12. Copy the Client ID into `backend/.env` as `GOOGLE_CLIENT_ID`.

## API Endpoints

> **Authentication Note**: All `/api/*` routes are protected and require an `Authorization: Bearer <Google_ID_Token>` header (verified via Google's OAuth2 public keys). For CLI testing scripts, `Bearer internal-load-test-token` is accepted.

### Health (Public)

```http
GET /health
```

### List Senders (Protected)

```http
GET /api/senders
Authorization: Bearer <token>
```

Returns all available SMTP senders in the database:
```json
{
  "senders": [
    {
      "id": "634bcf05-921c-4260-a6d5-9861aac191dd",
      "name": "Default Test Sender",
      "email": "h5t6pamf3ojod3fq@ethereal.email",
      "createdAt": "2026-08-13T04:52:27.033Z"
    }
  ]
}
```

### Schedule Emails (Protected)

```http
POST /api/schedule
Authorization: Bearer <token>
```

Request body:

```json
{
  "senderId": "sender-id",
  "recipients": ["lead1@example.com", "lead2@example.com"],
  "subject": "Hello from ReachInbox",
  "body": "<p>This is a scheduled email.</p>",
  "startTime": "2026-08-13T10:00:00.000Z",
  "delayBetweenMs": 2000,
  "hourlyLimit": 200
}
```

### List Scheduled Emails (Protected)

```http
GET /api/emails/scheduled
Authorization: Bearer <token>
```

Returns jobs with statuses:

- `pending`
- `queued`
- `delayed`
- `sending`

### List Sent Emails (Protected)

```http
GET /api/emails/sent
Authorization: Bearer <token>
```

Returns jobs with statuses:

- `sent` (includes `previewUrl` for Ethereal web viewing)
- `failed` (includes `lastError` error log)

### Parse Recipient Upload (Protected)

```http
POST /api/uploads/parse-recipients
Authorization: Bearer <token>
```

Form field:

```text
file
```

Accepts CSV or text files and extracts unique email addresses.

## Architecture Overview

### Scheduling

When the frontend submits a campaign, the backend receives:

- sender ID
- recipients
- subject
- body
- start time
- delay between emails
- hourly limit

The backend creates one `EmailJob` row per recipient in PostgreSQL. Each row stores the recipient, subject, body, scheduled time, status, batch ID, and BullMQ job ID.

For every database row, the backend adds a BullMQ delayed job to Redis. The delay is calculated from:

```text
scheduledAt - currentTime
```

Each BullMQ job stores:

```json
{
  "emailJobId": "database-row-id",
  "senderId": "sender-id",
  "hourlyLimit": 200
}
```

### Persistence

Persistence is handled by both PostgreSQL and Redis.

PostgreSQL stores the source of truth:

- email recipient
- status
- scheduled time
- sent time
- failure reason
- BullMQ job ID

Redis stores the BullMQ delayed jobs. Redis is configured in Docker with append-only persistence enabled:

```yaml
command: ["redis-server", "--appendonly", "yes"]
```

This means delayed jobs survive backend and worker restarts.

On API startup, the backend runs a reconciliation step. It finds `pending` database rows that may have been created before a crash but not successfully queued, and re-adds them to BullMQ using deterministic job IDs.

### Idempotency

Every BullMQ job uses a deterministic job ID:

```text
email-job-{emailJobId}
```

This prevents the same database row from being enqueued multiple times.

Before sending, the worker fetches the database row and checks its status. If the row is already marked `sent`, the worker skips it.

The worker only marks an email as `sent` after Ethereal SMTP confirms the send.

### Concurrency

Worker concurrency is configurable through:

```env
WORKER_CONCURRENCY=5
```

BullMQ processes multiple jobs in parallel according to this value.

### Minimum Delay Between Emails

The worker also uses a BullMQ limiter:

```text
max: 1
duration: MIN_DELAY_BETWEEN_EMAILS_MS
```

Example:

```env
MIN_DELAY_BETWEEN_EMAILS_MS=2000
```

This enforces a minimum delay between individual email sends, even when worker concurrency is greater than one.

### Hourly Rate Limiting

Rate limiting is Redis-backed and safe across multiple workers or instances.

The worker checks a Redis counter before sending. The counter is keyed by sender and hour window:

```text
ratelimit:sender:{senderId}:{epochHour}
```

If the sender is still under the hourly limit, the counter is incremented and the email is sent.

If the sender has reached the hourly limit:

- the job is not failed
- the job is not dropped
- the database status becomes `delayed`
- the BullMQ job is moved to the next hour window with `moveToDelayed`

The hourly limit is configurable:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

A schedule request can also pass a per-batch `hourlyLimit`.

## Load Test

The backend includes a load test script:

```powershell
npm run test:load
```

This enqueues 1000 emails with a low hourly limit to demonstrate rate-limit behavior.

Expected behavior:

- jobs are not dropped
- jobs are not failed due to rate limiting
- jobs beyond the hourly limit are delayed into the next hour window
- database status counts remain consistent

## Restart Persistence Test

Recommended test:

1. Start Docker.
2. Start backend API.
3. Start worker.
4. Schedule emails 2-5 minutes in the future.
5. Stop the backend API and worker before send time.
6. Restart backend API and worker.
7. Confirm emails are sent after restart.
8. Confirm database rows become `sent`.
9. Confirm emails are not duplicated.

## Frontend Features

The frontend includes:

- Google login with NextAuth
- Protected dashboard route via NextAuth session middleware
- Responsive Left Sidebar & Header navigation
- Scheduled Emails list with real-time status indicators
- Sent Emails list with direct Ethereal web preview links
- Full-page Compose screen matching Figma design
- Interactive Rich-Text formatting toolbar (Bold, Italic, Underline, Strikethrough, Headings, Ordered/Unordered Lists, Blockquotes, Align, Undo/Redo)
- Lead list file attachment (.csv, .txt) with parsed recipient tags and badge counter
- Multi-sender support with dynamic "From" SMTP sender dropdown (`GET /api/senders`)
- Multi-field Search & Status Filter popover
- Live 4-second auto-polling for instantaneous job status transitions
- Email Detail Modal View with full HTML body preview and Ethereal inspect links
- Instagram/LinkedIn style animated skeleton loading UI
- Empty states, loading states, and inline notice banners

## Feature Checklist

### Backend

- [x] Express + TypeScript backend
- [x] PostgreSQL database with Prisma ORM
- [x] Prisma migrations including `previewUrl` schema migration
- [x] Sender model with SMTP credentials & `GET /api/senders` endpoint
- [x] EmailJob model with persistent status, timestamps, and error logging
- [x] BullMQ delayed jobs with Redis persistence
- [x] No cron jobs (event-driven queue execution)
- [x] Ethereal SMTP delivery with test message preview URLs
- [x] Deterministic BullMQ job IDs
- [x] DB status check and idempotency before sending
- [x] Worker concurrency configured via environment variables
- [x] Minimum delay throttle between email sends
- [x] Redis-backed atomic hourly rate limiting
- [x] Requeue into next hourly window when rate limit is exceeded
- [x] Scheduled emails API (`GET /api/emails/scheduled`)
- [x] Sent emails API (`GET /api/emails/sent`)
- [x] CSV/text recipient parsing API (`POST /api/uploads/parse-recipients`)
- [x] Google ID token verification middleware (`requireGoogleAuth`) protecting all endpoints
- [x] CLI load test script (`npm run test:load`) with rate limit verification
- [x] Load test cleanup utility (`src/scripts/cleanLoadTest.ts`)

### Frontend

- [x] Next.js 14 App Router + TypeScript frontend
- [x] Tailwind CSS styling matching Figma design
- [x] Google OAuth via NextAuth.js
- [x] Protected dashboard routes with NextAuth middleware
- [x] User profile display with animated skeleton shimmer loading
- [x] Full-page Compose screen with back navigation
- [x] Dynamic From sender dropdown populated via `GET /api/senders`
- [x] Lead list upload (.csv, .txt) with recipient tag pills and paperclip badge
- [x] Start time picker with quick presets (Tomorrow 11 AM, Tomorrow 3 PM)
- [x] Configurable delay-between-emails and hourly limits
- [x] Interactive Rich Text Editor (`contentEditable`) with toolbar active state highlighting
- [x] Scheduled & Sent tabs with real-time 4-second auto-polling
- [x] Live search across recipients, subjects, and email bodies
- [x] Filter popover by job status (Queued, Delayed, Sending, Sent, Failed)
- [x] Email Detail Modal with full HTML preview and Ethereal viewer links
- [x] Logout functionality

## Assumptions and Trade-offs

- **Authentication**: Authentication is handled via Google OAuth 2.0 (NextAuth.js). The backend strictly validates Google JWT ID tokens on all API routes using `google-auth-library`. The Email/Password input fields on the login page are present for Figma visual fidelity. For CLI test scripts, `Bearer internal-load-test-token` is supported as an internal bypass.
- **Multi-Sender Architecture**: The database and backend support multiple SMTP senders. The Compose screen dynamically fetches all available senders from `GET /api/senders` and lets users select their sending identity. The `NEXT_PUBLIC_DEFAULT_SENDER_ID` environment variable serves only as an optional fallback.
- **Rate Limiting & Delay**:
  - `delayBetweenMs` controls spacing between recipients in a scheduled batch.
  - `MIN_DELAY_BETWEEN_EMAILS_MS` provides a worker-level throttle between sends.
  - Hourly rate limits use Redis atomic counters keyed by sender and hour window. When a limit is hit, jobs are delayed into the next hour window rather than dropped.
- **Email Delivery**: Test emails are delivered through Ethereal SMTP and test inspection links (`previewUrl`) are stored and accessible directly from the dashboard.
- **Persistence & Recovery**: All scheduled and sent states are persisted in PostgreSQL. In the event of a worker or server restart, pending/delayed jobs are safely reconciled.

## Useful Commands

### Backend

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run test:ethereal
npx ts-node-dev --transpile-only src/scripts/seedSender.ts

# Optional: Seed a second sender for multi-sender testing
$env:SEED_SENDER_EMAIL="second-user@ethereal.email"
$env:SEED_SENDER_PASS="second-pass"
npx ts-node-dev --transpile-only src/scripts/seedSecondSender.ts

# Run servers
npm run dev
npm run worker

# Run load test & clean up
npm run test:load
npm run test:clean
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Type Checks & Builds

```powershell
cd backend
npm run build
```

```powershell
cd frontend
npm run build
```

## Submission Notes

Before submitting:

- Confirm Docker services (PostgreSQL & Redis) are healthy.
- Confirm backend API (`http://localhost:4000`) and worker are running.
- Confirm frontend (`http://localhost:3000`) is running.
- Verify Google login and protected route navigation.
- Verify scheduling batch emails with custom delays and hourly limits.
- Inspect scheduled emails, live auto-polling status updates, and sent email Ethereal previews.
- Run `npm run test:load` to demonstrate rate limiting and concurrency at scale.

