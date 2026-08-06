import { getSupabase } from "./supabase";

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.idle_logout"
  | "auth.sign_up"
  | "payment.posting_fee"
  | "payment.membership_fee"
  | "project.publish"
  | "project.lock"
  | "bid.place"
  | "bid.award"
  | "contract.countersign"
  | "milestone.fund"
  | "milestone.accept"
  | "identity.submit"
  | "clarification.ask"
  | "clarification.answer"
  | "guardrail.block"
  | "assist.request"
  | "assist.complete"
  | "terms.accept"
  | "block.request"
  | "block.approve"
  | "block.reject";

/**
 * Fire-and-forget audit write. Never throws to the caller — logging must not
 * break the product action that triggered it.
 */
export function logAudit(
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  detail?: Record<string, unknown>
): void {
  const client = getSupabase();
  if (!client) return;

  void client
    .rpc("write_audit_event", {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ?? null,
      p_detail: detail ?? {},
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        console.warn("audit log failed", action, error.message);
      }
    });
}
