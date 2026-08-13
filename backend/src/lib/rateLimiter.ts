import { connection } from "./redis";

const WINDOW_SECONDS = 3600;

/**
 * Fixed hour-window key, e.g. "ratelimit:sender:<id>:471234" where 471234 is
 * epoch-hours. All workers/instances share this via Redis, so the counter is
 * correct even with WORKER_CONCURRENCY > 1 or multiple worker processes.
 */
function windowKey(senderId: string, atMs: number): string {
  const epochHour = Math.floor(atMs / (WINDOW_SECONDS * 1000));
  return `ratelimit:sender:${senderId}:${epochHour}`;
}

/** Start (ms) of the next hour window after `atMs`. */
export function nextWindowStart(atMs: number): number {
  const epochHour = Math.floor(atMs / (WINDOW_SECONDS * 1000));
  return (epochHour + 1) * WINDOW_SECONDS * 1000;
}

/**
 * Atomically increments the counter for this sender's current hour window
 * and reports whether the caller is still within `limit`.
 *
 * Uses a single INCR (atomic in Redis) so concurrent workers never race —
 * two workers incrementing "simultaneously" still get distinct, correct
 * counts back from Redis.
 */
export async function tryConsumeSlot(
  senderId: string,
  limit: number,
  atMs: number = Date.now()
): Promise<{ allowed: boolean; count: number }> {
  const key = windowKey(senderId, atMs);

  const count = await connection.incr(key);
  if (count === 1) {
    // first hit in this window — set expiry so old windows don't leak memory
    await connection.expire(key, WINDOW_SECONDS + 60);
  }

  if (count > limit) {
    // we over-incremented; back it off so a later, correctly-timed send
    // in this same window isn't unfairly blocked by our own failed attempt
    await connection.decr(key);
    return { allowed: false, count: count - 1 };
  }

  return { allowed: true, count };
}