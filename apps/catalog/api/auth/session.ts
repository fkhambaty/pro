import {
  assertCookieMutation,
  clearRefreshCookie,
  json,
  publicSession,
  refreshCookie,
  refreshSession,
  upstreamError,
  type PublicSession,
} from "./_shared";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const invalid = assertCookieMutation(request);
  if (invalid) return invalid;

  const { response, body } = await refreshSession(request);
  if (!response.ok) {
    const error = upstreamError(response, body);
    error.headers.append("Set-Cookie", clearRefreshCookie(request));
    return error;
  }

  const session = body as PublicSession & { refresh_token: string };
  return json(
    { session: publicSession(session) },
    { headers: { "Set-Cookie": refreshCookie(request, session.refresh_token) } }
  );
}
