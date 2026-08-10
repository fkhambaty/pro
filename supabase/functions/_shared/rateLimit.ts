import { json, serviceClient } from "./backend.ts";

export type RateLimitRule = {
  scope: string;
  actor: string;
  limit: number;
  windowSeconds: number;
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Consumes one request from an atomic Postgres rate-limit bucket.
 * Only a one-way hash is stored, so user IDs/IPs never land in the table.
 * Infra failures fail open so a rate-limit outage cannot take payments offline.
 */
export async function consumeRateLimit(rule: RateLimitRule): Promise<boolean> {
  try {
    const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "okavo-edge-v1";
    const bucketHash = await sha256(`${salt}:${rule.scope}:${rule.actor}`);
    const result = await serviceClient().rpc("consume_edge_rate_limit", {
      p_bucket_hash: bucketHash,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (typeof result === "boolean") return result;
    if (Array.isArray(result)) return result[0] === true;
    return false;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        source: "rate-limit",
        code: "rate_limit_check_failed",
        scope: rule.scope,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      })
    );
    return true;
  }
}

export function requestIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Consistent 429 body used by every throttled edge endpoint. */
export function tooManyRequests(
  req: Request,
  retryAfterSeconds: number,
  message = "Too many requests. Please try again shortly."
): Response {
  return json(
    429,
    {
      error: message,
      retry_after_seconds: retryAfterSeconds,
    },
    req
  );
}
