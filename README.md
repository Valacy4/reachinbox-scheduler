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

### Health

```http
GET /health
```

### Schedule Emails

```http
POST /api/schedule
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

### List Scheduled Emails

```http
GET /api/emails/scheduled
```

Returns jobs with statuses:

- `pending`
- `queued`
- `delayed`
- `sending`

### List Sent Emails

```http
GET /api/emails/sent
```

Returns jobs with statuses:

- `sent`
- `failed`

### Parse Recipient Upload

```http
POST /api/uploads/parse-recipients
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
- protected dashboard route
- top header with user name, email, avatar, and logout
- Scheduled Emails tab
- Sent Emails tab
- Compose New Email modal
- CSV/text upload for leads
- parsed email count display
- start time input
- delay-between-emails input
- hourly limit input
- loading states
- empty states
- API error messages
- schedule success message

## Feature Checklist

### Backend

- [x] Express + TypeScript backend
- [x] PostgreSQL database
- [x] Prisma schema and migration
- [x] Sender model with SMTP credentials
- [x] EmailJob model with persistent status
- [x] BullMQ delayed jobs
- [x] Redis-backed queue persistence
- [x] No cron jobs
- [x] Ethereal SMTP sending
- [x] Deterministic BullMQ job IDs
- [x] DB status check before sending
- [x] Worker concurrency from env
- [x] Minimum delay between email sends
- [x] Redis-backed hourly rate limiting
- [x] Requeue into next hour when limit is reached
- [x] Scheduled emails API
- [x] Sent emails API
- [x] CSV/text recipient parsing API
- [x] Google ID token verification middleware stub
- [x] Load test script

### Frontend

- [x] Next.js + TypeScript frontend
- [x] Tailwind CSS styling
- [x] Google OAuth via NextAuth
- [x] Protected dashboard route
- [x] Header with user profile
- [x] Logout
- [x] Scheduled Emails table
- [x] Sent Emails table
- [x] Compose New Email modal
- [x] CSV/text upload
- [x] Parsed recipient count
- [x] Start time input
- [x] Delay between emails input
- [x] Hourly limit input
- [x] Loading states
- [x] Empty states
- [x] Basic error handling

## Assumptions and Trade-offs

- The app uses one default sender in the frontend through `NEXT_PUBLIC_DEFAULT_SENDER_ID`.
- The backend supports multiple senders in the database and worker logic, but the current UI schedules from one configured sender.
- There are two delay concepts:
  - `delayBetweenMs` controls spacing between recipients in a scheduled batch.
  - `MIN_DELAY_BETWEEN_EMAILS_MS` is a worker-level global throttle that prevents emails from being sent too quickly.
- Rate limiting is implemented per sender using fixed hourly Redis windows.
- When the hourly limit is reached, jobs are delayed into the next hour window instead of being failed or dropped.
- Ethereal is used only for fake SMTP testing; no real emails are sent.
- The frontend is wired to local backend URLs by default.
- Google auth is implemented on the frontend through NextAuth. Backend Google token verification middleware exists, but routes are not strictly protected yet.
- The UI is functional and clean, but exact Figma matching depends on having the final Figma reference available.
- The load test demonstrates queue/rate-limit behavior without relying on real production email throughput.

## Useful Commands

### Backend

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run test:ethereal
npx ts-node-dev --transpile-only src/scripts/seedSender.ts
npm run dev
npm run worker
npm run test:load
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Type Checks

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

- Confirm Docker services are healthy.
- Confirm backend API starts.
- Confirm worker starts.
- Confirm Google login works.
- Confirm schedule flow works from the frontend.
- Confirm scheduled emails appear in the Scheduled tab.
- Confirm sent emails appear in the Sent tab.
- Record restart persistence demo.
- Record rate-limit demo with a low hourly limit.
- Push to a private GitHub repository.
- Grant access to the required reviewers.
- Submit the form with GitHub and demo video links.
