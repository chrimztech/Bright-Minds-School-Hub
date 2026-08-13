import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, getStoredUser, setStoredUser, setToken, type AuthUser } from "@/lib/api";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  roles: string[];
  login: (identifier: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  signOut: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  roles: [],
  login: async () => ({ mustChangePassword: false }),
  signOut: () => {},
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

  return (
    <Ctx.Provider value={{ user, loading, roles: user?.roles ?? [], login, signOut } as AuthCtx}>
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
