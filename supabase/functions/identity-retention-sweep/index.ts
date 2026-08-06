import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { json, requireEnv, serviceClient } from "../_shared/backend.ts";

function serviceHeaders() {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function removeObject(path: string) {
  if (!path || path === "[purged]") return;
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${requireEnv("SUPABASE_URL")}/storage/v1/object/identity-documents/${safePath}`,
    { method: "DELETE", headers: serviceHeaders() }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error("Private object deletion failed");
  }
}

async function rpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(
    `${requireEnv("SUPABASE_URL")}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) throw new Error(`${name} failed`);
}

type Verification = {
  id: string;
  developer_id: string;
  document_storage_path: string;
  selfie_storage_path: string | null;
};

serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (
    !Deno.env.get("IDENTITY_SWEEP_SECRET") ||
    req.headers.get("x-okavo-notify") !== Deno.env.get("IDENTITY_SWEEP_SECRET")
  ) {
    return json(401, { error: "Unauthorized" });
  }

  const db = serviceClient();
  let purged = 0;
  let failed = 0;
  try {
    const due = (await db.select(
      `identity_verifications?expires_at=lte.${new Date().toISOString().slice(0, 10)}` +
        "&document_storage_path=neq.%5Bpurged%5D" +
        "&select=id,developer_id,document_storage_path,selfie_storage_path&limit=200"
    )) as Verification[];

    for (const verification of due) {
      try {
        await removeObject(verification.document_storage_path);
        if (verification.selfie_storage_path) {
          await removeObject(verification.selfie_storage_path);
        }
        await rpc("redact_identity_paths", {
          p_verification_id: verification.id,
        });
        purged += 1;
      } catch {
        failed += 1;
        await db.insert("ops_events", {
          severity: "critical",
          category: "privacy",
          code: "identity_retention_purge_failed",
          summary: "An expired identity document could not be purged",
          entity_type: "identity_verification",
          entity_id: verification.id,
        });
      }
    }

    const requests = (await db.select(
      "account_erasure_requests?status=eq.requested&select=id,profile_id&limit=50"
    )) as Array<{ id: string; profile_id: string }>;
    for (const request of requests) {
      try {
        const records = (await db.select(
          `identity_verifications?developer_id=eq.${request.profile_id}` +
            "&document_storage_path=neq.%5Bpurged%5D" +
            "&select=id,developer_id,document_storage_path,selfie_storage_path"
        )) as Verification[];
        for (const verification of records) {
          await removeObject(verification.document_storage_path);
          if (verification.selfie_storage_path) {
            await removeObject(verification.selfie_storage_path);
          }
        }
        await rpc("complete_identity_erasure", { p_request_id: request.id });
        purged += records.length;
      } catch {
        failed += 1;
        await db.insert("ops_events", {
          severity: "critical",
          category: "privacy",
          code: "account_erasure_failed",
          summary: "An account erasure request could not be completed",
          entity_type: "account_erasure_request",
          entity_id: request.id,
        });
      }
    }

    return json(200, { purged, failed });
  } catch {
    console.error("identity-retention-sweep failed");
    return json(500, { error: "Identity retention sweep failed" });
  }
});
