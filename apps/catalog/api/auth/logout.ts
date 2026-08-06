import {
  anonKey,
  assertCookieMutation,
  clearRefreshCookie,
  json,
  publicSession,
  refreshSession,
  supabaseUrl,
  type PublicSession,
} from "./_shared";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const invalid = assertCookieMutation(request);
  if (invalid) return invalid;

  const { response, body } = await refreshSession(request);
  if (response.ok) {
    const session = publicSession(
      body as PublicSession & { refresh_token: string }
    );
    await fetch(`${supabaseUrl()}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: anonKey(),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  }

  return json(
    { ok: true },
    { headers: { "Set-Cookie": clearRefreshCookie(request) } }
  );
}
