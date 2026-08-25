import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, getStoredUser, setStoredUser, setToken, type AuthUser } from "@/lib/api";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  roles: string[];
  permissions: string[];
  login: (identifier: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  signOut: () => void;
  clearMustChangePassword: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  roles: [],
  permissions: [],
  login: async () => ({ mustChangePassword: false }),
  signOut: () => {},
  clearMustChangePassword: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.auth.login(identifier, password);
    const authUser: AuthUser = {
      userId: res.userId,
      email: res.email,
      fullName: res.fullName,
      roles: res.roles,
      permissions: (res as any).permissions ?? [],
      token: res.token,
      mustChangePassword: (res as any).mustChangePassword ?? false,
    };
    setToken(res.token);
    setStoredUser(authUser);
    setUser(authUser);
    return { mustChangePassword: authUser.mustChangePassword ?? false };
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // The _authenticated layout guard redirects to /change-password on every navigation while
  // this flag is true (see route.tsx) — without a way to flip it locally right after a
  // successful change, the very next navigate("/dashboard") in change-password.tsx would read
  // the still-stale stored flag and bounce straight back, trapping the user in a redirect loop.
  const clearMustChangePassword = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, mustChangePassword: false };
      setStoredUser(updated);
      return updated;
    });
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, roles: user?.roles ?? [], permissions: user?.permissions ?? [], login, signOut, clearMustChangePassword } as AuthCtx}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export const ADMIN_ROLES = ["SUPER_ADMIN", "HEAD_TEACHER", "DEPUTY_HEAD", "ADMIN"];
export const FINANCE_ROLES = ["SUPER_ADMIN", "HEAD_TEACHER", "ADMIN", "ACCOUNTANT"];
export const TEACHING_ROLES = ["SUPER_ADMIN", "HEAD_TEACHER", "DEPUTY_HEAD", "ADMIN", "TEACHER", "CLASS_TEACHER"];

export function hasAny(roles: string[], needed: string[]) {
  return roles.some((r) => needed.includes(r));
}

// Checks the user's actual granted permissions (resolved server-side at login from their
// role(s), same source of truth the backend's @PreAuthorize checks use) rather than a
// hardcoded role-name list — this is what UI gating (nav visibility, action buttons) should
// use so a custom role's granted permissions actually surface in the UI. Accepts either a
// single permission or a list where any one match is sufficient (e.g. view-or-manage pairs).
export function hasPermission(permissions: string[], required?: string | string[]) {
  if (!required) return true;
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((p) => permissions.includes(p));
}
