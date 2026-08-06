import { serviceClient } from "./backend.ts";

export type OpsSeverity = "info" | "warning" | "critical";

export type OpsEvent = {
  category: string;
  code: string;
  summary: string;
  severity?: OpsSeverity;
  entityType?: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
};

const SENSITIVE_KEYS = /token|secret|password|signature|authorization|document|selfie|url/i;

function sanitize(
  detail: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!detail) return {};
  return Object.fromEntries(
    Object.entries(detail)
      .filter(([key]) => !SENSITIVE_KEYS.test(key))
      .slice(0, 20)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 300) : value,
      ])
  );
}

/**
 * Best-effort structured operational event. Monitoring must never turn a
 * recoverable product failure into a second failure.
 */
export async function recordOpsEvent(event: OpsEvent): Promise<void> {
  try {
    await serviceClient().insert("ops_events", {
      severity: event.severity ?? "warning",
      category: event.category.slice(0, 80),
      code: event.code.slice(0, 100),
      summary: event.summary.slice(0, 300),
      entity_type: event.entityType?.slice(0, 80) ?? null,
      entity_id: event.entityId ?? null,
      detail: sanitize(event.detail),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        source: "ops-recorder",
        code: "ops_event_write_failed",
        original_category: event.category,
        original_code: event.code,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      })
    );
  }
}
