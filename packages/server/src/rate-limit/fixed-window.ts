export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export interface RateLimiter {
  consume(scope: string, key: string, rule: RateLimitRule, now?: Date): RateLimitDecision;
}

interface FixedWindowBucket {
  windowStartedAtMs: number;
  count: number;
}

export class InMemoryFixedWindowRateLimiter implements RateLimiter {
  readonly #buckets = new Map<string, FixedWindowBucket>();

  consume(scope: string, key: string, rule: RateLimitRule, now = new Date()): RateLimitDecision {
    const bucketKey = `${scope}:${key}`;
    const nowMs = now.getTime();
    const existingBucket = this.#buckets.get(bucketKey);
    const activeBucket = existingBucket && nowMs - existingBucket.windowStartedAtMs < rule.windowMs
      ? existingBucket
      : { windowStartedAtMs: nowMs, count: 0 };

    if (activeBucket.count >= rule.maxRequests) {
      const retryAfterMs = activeBucket.windowStartedAtMs + rule.windowMs - nowMs;

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        remaining: 0,
      };
    }

    activeBucket.count += 1;
    this.#buckets.set(bucketKey, activeBucket);

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, rule.maxRequests - activeBucket.count),
    };
  }
}

export function getClientRateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const [firstForwarded] = forwardedFor.split(",");
    const candidate = firstForwarded?.trim();

    if (candidate) {
      return candidate;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  return "anonymous";
}
