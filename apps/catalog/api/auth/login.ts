import {
  assertAuthRateLimit,
  assertCookieMutation,
  authHeaders,
  json,
  publicSession,
  readSupabaseResponse,
  refreshCookie,
  supabaseUrl,
  upstreamError,
  type PublicSession,
} from "./_shared";

export const config = { runtime: "edge" };

type LoginBody = {
  email?: string;
  password?: string;
};

export default async function handler(request: Request): Promise<Response> {
  const invalid = assertCookieMutation(request);
  if (invalid) return invalid;

  const throttled = await assertAuthRateLimit(request, "login", 20, 900);
  if (throttled) return throttled;

  let input: LoginBody;
  try {
    input = (await request.json()) as LoginBody;
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  if (!input.email || !input.password) {
    return json({ error: "Email and password are required." }, { status: 400 });
  }

  const response = await fetch(
    `${supabaseUrl()}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    }
  );
  const body = await readSupabaseResponse(response);
  if (!response.ok) return upstreamError(response, body);

  const session = body as PublicSession & { refresh_token: string };
  return json(
    { session: publicSession(session) },
    { headers: { "Set-Cookie": refreshCookie(request, session.refresh_token) } }
  );
}
