/**
 * In-memory rate limiter for API routes (e.g. auth endpoints).
 * Use a distributed store (Redis) in production for multi-instance deployments.
 */

const store = new Map<string, { count: number; resetAt: number }>();

function prune(): void {
  const now = Date.now();
  for (const [key, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(key);
  }
}

/**
 * Check rate limit for identifier (e.g. IP). Returns ok: false when over limit.
 * @param identifier - e.g. IP from x-forwarded-for or x-real-ip
 * @param windowMs - window in ms (e.g. 15 * 60 * 1000 for 15 min)
 * @param max - max requests per window
 */
export function checkRateLimit(
  identifier: string,
  windowMs: number,
  max: number
): { ok: boolean; remaining: number; resetAt: number } {
  if (max <= 0) return { ok: true, remaining: 0, resetAt: Date.now() + windowMs };
  const now = Date.now();
  // Prune occasionally to avoid unbounded growth
  if (Math.random() < 0.01) prune();
  const key = `${identifier}:${windowMs}`;
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  entry.count += 1;
  const remaining = Math.max(0, max - entry.count);
  const ok = entry.count <= max;
  return { ok, remaining, resetAt: entry.resetAt };
}

/** Get client identifier from request (e.g. for rate limiting). Prefer x-forwarded-for when behind a proxy. */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

// ── Pre-configured rate limiters (audit findings A2, I4) ──

/** Admin API routes: 30 requests per minute per admin user */
export function checkAdminRateLimit(adminUserId: string) {
  return checkRateLimit(`admin:${adminUserId}`, 60_000, 30);
}

/** Login attempts per email: 5 per minute */
export function checkLoginRateLimit(email: string) {
  return checkRateLimit(`login:email:${email.toLowerCase()}`, 60_000, 5);
}

/** Login attempts per IP: 20 per minute */
export function checkLoginIpRateLimit(ip: string) {
  return checkRateLimit(`login:ip:${ip}`, 60_000, 20);
}
