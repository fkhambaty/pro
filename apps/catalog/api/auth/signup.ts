import {
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

  const response = await fetch(`${supabaseUrl()}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: input.data ?? {},
    }),
  });
  const body = await readSupabaseResponse(response);
  if (!response.ok) return upstreamError(response, body);

  if (
    typeof body.access_token === "string" &&
    typeof body.refresh_token === "string"
  ) {
    const session = body as PublicSession & { refresh_token: string };
    return json(
      { user: session.user, session: publicSession(session) },
      {
        headers: {
          "Set-Cookie": refreshCookie(request, session.refresh_token),
        },
      }
    );
  }

  return json({ user: body.user ?? body, session: null });
}
