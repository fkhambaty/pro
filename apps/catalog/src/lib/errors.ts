/**
 * Supabase rejects with a plain object, not an Error, so the usual
 * `cause instanceof Error ? cause.message : String(cause)` renders the useless
 * string "[object Object]" and hides the real reason from the user.
 */
export function errorMessage(
  cause: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (typeof cause === "string" && cause.trim()) return cause;

  if (cause instanceof Error && cause.message) return cause.message;

  if (cause && typeof cause === "object") {
    const record = cause as Record<string, unknown>;
    for (const key of ["message", "error_description", "error", "details", "hint"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return fallback;
}
