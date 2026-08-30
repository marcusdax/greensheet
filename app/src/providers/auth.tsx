import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import type { UserRole } from "@contracts/constants";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  roasterId: number | null;
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  return (
    <AuthContext.Provider value={{ user: me.data ?? null, isLoading: me.isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
