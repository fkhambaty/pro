import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { BuyerScale, Role } from "../types";

type SignUpInput = {
  email: string;
  password: string;
  role: Exclude<Role, "guest">;
  fullName: string;
  organizationName?: string;
  scale?: BuyerScale;
};

async function notifySupportOfSignup(details: {
  email: string;
  role: string;
  full_name: string;
  organization_name: string;
  user_id?: string;
}) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const secret = import.meta.env.VITE_OKAVO_NOTIFY_SECRET;
  if (!base || !anon || !secret) return;

  try {
    await fetch(`${base}/functions/v1/notify-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
        apikey: anon,
        "x-okavo-notify": secret,
      },
      body: JSON.stringify(details),
    });
  } catch {
    // Never block signup if the support alert fails.
  }
}

type AuthValue = {
  ready: boolean;
  connected: boolean;
  userId: string | null;
  email: string | null;
  role: Role;
  displayName: string;
  emailVerified: boolean;
  error: string | null;
  notice: string | null;
  passwordRecovery: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  demoSignIn: (role: Exclude<Role, "guest">, name: string) => void;
  clearMessages: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

const SCALE_TO_DB: Record<BuyerScale, string> = {
  "Local business": "local_business",
  SMB: "smb",
  Startup: "startup",
  Enterprise: "enterprise",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>("guest");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  /**
   * Creates the profile rows on first authenticated load. Doing it here rather
   * than during sign-up means it still works when email confirmation is on and
   * no session exists at sign-up time.
   */
  const ensureProfile = useCallback(async (activeSession: Session) => {
    if (!supabase) return;
    const { user } = activeSession;
    const meta = user.user_metadata ?? {};
    const metaRole = meta.role;
    // Never accept admin from the client. Admin is granted only in the database.
    const desiredRole: Exclude<Role, "guest" | "admin"> =
      metaRole === "developer" ? "developer" : "buyer";
    const fullName = (meta.full_name as string) || user.email || "Okavo user";

    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (readError) {
      setError(readError.message);
      return;
    }

    if (!existing) {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        role: desiredRole,
        full_name: fullName,
        email: user.email,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }

      if (desiredRole === "buyer") {
        await supabase.from("buyer_profiles").insert({
          profile_id: user.id,
          organization_name:
            (meta.organization_name as string) || fullName,
          scale: (meta.scale as string) || "local_business",
        });
      } else if (desiredRole === "developer") {
        await supabase.from("developer_profiles").insert({
          profile_id: user.id,
          headline: "",
          tier: "applicant",
        });
      }

      setRole(desiredRole);
      setDisplayName(fullName);
      return;
    }

    const storedRole = existing.role;
    setRole(
      storedRole === "developer" || storedRole === "admin" ? storedRole : "buyer"
    );
    setDisplayName(existing.full_name);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        ensureProfile(data.session).finally(() => setReady(true));
      } else {
        setReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession);
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecovery(true);
        }
        if (nextSession) {
          ensureProfile(nextSession);
        } else {
          setRole("guest");
          setDisplayName("");
          setPasswordRecovery(false);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [ensureProfile]);

  const signUp = useCallback(async (input: SignUpInput) => {
    setError(null);
    setNotice(null);
    if (!supabase) return;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          role: input.role,
          full_name: input.fullName,
          organization_name: input.organizationName ?? input.fullName,
          scale: input.scale ? SCALE_TO_DB[input.scale] : "local_business",
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    void notifySupportOfSignup({
      email: input.email,
      role: input.role,
      full_name: input.fullName,
      organization_name: input.organizationName ?? input.fullName,
      user_id: data.user?.id,
    });

    if (!data.session) {
      setNotice(
        `We sent a verification link to ${input.email}. Confirm the address, then sign in.`
      );
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setError(null);
    setNotice(null);
    if (!supabase) return;
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setNotice(`Verification link sent again to ${email}.`);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    setNotice(null);
    if (!supabase) return;
    const redirectTo = `${window.location.origin}/signin`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo }
    );
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice(
      `If an account exists for ${email}, we sent a link to choose a new password.`
    );
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setError(null);
    setNotice(null);
    if (!supabase) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPasswordRecovery(false);
    setNotice("Password updated. You are signed in.");
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setNotice(null);
    if (!supabase) return;
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) setError(signInError.message);
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setRole("guest");
    setDisplayName("");
  }, []);

  const demoSignIn = useCallback(
    (nextRole: Exclude<Role, "guest">, name: string) => {
      setRole(nextRole);
      setDisplayName(name);
    },
    []
  );

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      connected: isSupabaseConfigured,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      role,
      displayName,
      emailVerified: Boolean(
        session?.user.email_confirmed_at ?? session?.user.confirmed_at
      ),
      error,
      notice,
      passwordRecovery,
      signUp,
      signIn,
      signOut,
      resendVerification,
      resetPassword,
      updatePassword,
      demoSignIn,
      clearMessages,
    }),
    [
      ready,
      session,
      role,
      displayName,
      error,
      notice,
      passwordRecovery,
      signUp,
      signIn,
      signOut,
      resendVerification,
      resetPassword,
      updatePassword,
      demoSignIn,
      clearMessages,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
