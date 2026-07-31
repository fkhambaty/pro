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

type AuthValue = {
  ready: boolean;
  connected: boolean;
  userId: string | null;
  email: string | null;
  role: Role;
  displayName: string;
  error: string | null;
  notice: string | null;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  /**
   * Creates the profile rows on first authenticated load. Doing it here rather
   * than during sign-up means it still works when email confirmation is on and
   * no session exists at sign-up time.
   */
  const ensureProfile = useCallback(async (activeSession: Session) => {
    if (!supabase) return;
    const { user } = activeSession;
    const meta = user.user_metadata ?? {};
    const desiredRole: Exclude<Role, "guest"> =
      meta.role === "developer" ? "developer" : "buyer";
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
      } else {
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

    setRole(existing.role === "developer" ? "developer" : "buyer");
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
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession) {
          ensureProfile(nextSession);
        } else {
          setRole("guest");
          setDisplayName("");
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

    if (!data.session) {
      setNotice(
        "Account created. Check your inbox to confirm the address, then sign in."
      );
    }
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
      error,
      notice,
      signUp,
      signIn,
      signOut,
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
      signUp,
      signIn,
      signOut,
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
