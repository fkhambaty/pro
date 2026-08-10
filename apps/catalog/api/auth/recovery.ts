import {
  assertAuthRateLimit,
  assertCookieMutation,
  authHeaders,
  challengeFor,
  json,
  pkceCookie,
  randomVerifier,
  readSupabaseResponse,
  redirectOrigin,
  supabaseUrl,
  upstreamError,
} from "./_shared";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const invalid = assertCookieMutation(request);
  if (invalid) return invalid;

  const throttled = await assertAuthRateLimit(request, "recovery", 10, 3600);
  if (throttled) return throttled;

  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email;
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email) {
    return json({ error: "Email is required." }, { status: 400 });
  }

  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  const redirectTo = `${redirectOrigin(request)}/api/auth/callback`;
  const response = await fetch(
    `${supabaseUrl()}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        email,
        code_challenge: challenge,
        code_challenge_method: "s256",
      }),
    }
  );
  const body = await readSupabaseResponse(response);
  if (!response.ok) return upstreamError(response, body);

  return json(
    { ok: true },
    { headers: { "Set-Cookie": pkceCookie(request, verifier, "recovery") } }
  );
}
