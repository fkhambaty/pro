import type { Session, User } from "@supabase/supabase-js";

type PublicSession = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: User;
};

type SessionListener = (session: Session | null) => void;

let currentSession: Session | null = null;
let refreshPromise: Promise<Session | null> | null = null;
const listeners = new Set<SessionListener>();

function asSession(session: PublicSession): Session {
  return {
    access_token: session.access_token,
    // The real refresh token exists only in the HttpOnly cookie.
    refresh_token: "",
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  };
}

function publish(session: Session | null): Session | null {
  currentSession = session;
  for (const listener of listeners) listener(session);
  return session;
}

async function request<T>(
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-okavo-csrf": "1",
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Authentication request failed.");
  }
  return payload as T;
}

export function getMemorySession(): Session | null {
  return currentSession;
}

export function onMemorySessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshMemorySession(): Promise<Session | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = request<{ session: PublicSession }>("/api/auth/session")
    .then(({ session }) => publish(asSession(session)))
    .catch(() => publish(null))
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function getAccessToken(): Promise<string | null> {
  const expiresAt = currentSession?.expires_at ?? 0;
  if (!currentSession || expiresAt <= Math.floor(Date.now() / 1000) + 60) {
    await refreshMemorySession();
  }
  return currentSession?.access_token ?? null;
}

export async function receptionistSignIn(
  email: string,
  password: string
): Promise<Session> {
  const { session } = await request<{ session: PublicSession }>(
    "/api/auth/login",
    { email, password }
  );
  return publish(asSession(session)) as Session;
}

export async function receptionistSignUp(input: {
  email: string;
  password: string;
  data: Record<string, unknown>;
}): Promise<{ user: User | null; session: Session | null }> {
  const result = await request<{
    user: User | null;
    session: PublicSession | null;
  }>("/api/auth/signup", input);
  const session = result.session ? asSession(result.session) : null;
  publish(session);
  return { user: result.user, session };
}

export async function receptionistSignOut(): Promise<void> {
  try {
    await request<{ ok: true }>("/api/auth/logout");
  } finally {
    publish(null);
  }
}

export async function requestPasswordRecovery(email: string): Promise<void> {
  await request<{ ok: true }>("/api/auth/recovery", { email });
}
