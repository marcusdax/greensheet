import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

// A session expiring mid-poll must land the user on /login, not error-loop.
function redirectOnExpiredSession(error: unknown) {
  if (
    error instanceof TRPCClientError &&
    error.data?.code === "UNAUTHORIZED" &&
    window.location.pathname !== "/login"
  ) {
    window.location.href = "/login";
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: redirectOnExpiredSession }),
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
