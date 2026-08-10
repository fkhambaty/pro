import {
  authHeaders,
  clearPkceCookie,
  json,
  pkcePurpose,
  pkceVerifier,
  readSupabaseResponse,
  redirectOrigin,
  refreshCookie,
  supabaseUrl,
  upstreamError,
  type PublicSession,
} from "./_shared";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const verifier = pkceVerifier(request);
  const purpose = pkcePurpose(request);
  if (!code || !verifier) {
    return Response.redirect(
      `${redirectOrigin(request)}/signin?recovery=failed`,
      303
    );
  }

  const response = await fetch(
    `${supabaseUrl()}/auth/v1/token?grant_type=pkce`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        auth_code: code,
        code_verifier: verifier,
      }),
    }
  );
  const body = await readSupabaseResponse(response);
  if (!response.ok) {
    const error = upstreamError(response, body);
    error.headers.append("Set-Cookie", clearPkceCookie(request));
    return error;
  }

  const session = body as PublicSession & { refresh_token: string };
  const destination =
    purpose === "recovery" ? "/signin?recovery=1" : "/signin?confirmed=1";
  const headers = new Headers({
    Location: `${redirectOrigin(request)}${destination}`,
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", refreshCookie(request, session.refresh_token));
  headers.append("Set-Cookie", clearPkceCookie(request));
  return new Response(null, { status: 303, headers });
}
