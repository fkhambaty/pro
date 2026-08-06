import {
  assertCookieMutation,
  authHeaders,
  challengeFor,
  clearPkceCookie,
  json,
  pkceCookie,
  publicSession,
  randomVerifier,
  readSupabaseResponse,
  redirectOrigin,
  refreshCookie,
  supabaseUrl,
  upstreamError,
  type PublicSession,
} from "./_shared";

export const config = { runtime: "edge" };

type SignupBody = {
  email?: string;
  password?: string;
  data?: Record<string, unknown>;
};

export default async function handler(request: Request): Promise<Response> {
  const invalid = assertCookieMutation(request);
  if (invalid) return invalid;

  let input: SignupBody;
  try {
    input = (await request.json()) as SignupBody;
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  if (!input.email || !input.password) {
    return json({ error: "Email and password are required." }, { status: 400 });
  }

  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  const response = await fetch(`${supabaseUrl()}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: input.data ?? {},
      redirect_to: `${redirectOrigin(request)}/api/auth/callback`,
      code_challenge: challenge,
      code_challenge_method: "s256",
    }),
  });
  const body = await readSupabaseResponse(response);
  if (!response.ok) return upstreamError(response, body);

  if (
    typeof body.access_token === "string" &&
    typeof body.refresh_token === "string"
  ) {
    const session = body as PublicSession & { refresh_token: string };
    const headers = new Headers();
    headers.append("Set-Cookie", refreshCookie(request, session.refresh_token));
    headers.append("Set-Cookie", clearPkceCookie(request));
    return json(
      { user: session.user, session: publicSession(session) },
      { headers }
    );
  }

  return json(
    { user: body.user ?? body, session: null },
    { headers: { "Set-Cookie": pkceCookie(request, verifier, "signup") } }
  );
}
