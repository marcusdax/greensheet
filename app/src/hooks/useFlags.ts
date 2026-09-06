// Runtime feature flags in the client — ADR-05, §8.1.
//
// Cached 30s, so flipping `autoAllocation` off reaches every open browser in
// under half a minute with no deploy and no restart (§14.11). VITE_* variables
// survive only as a local-dev override.
import { trpc } from "@/providers/trpc";
import {
  FLAG_CACHE_MS,
  defaultFlags,
  type FlagKey,
  type Flags,
} from "@contracts/flags";

export function useFlags(): { flags: Flags; isLoading: boolean } {
  const query = trpc.config.flags.useQuery(undefined, {
    staleTime: FLAG_CACHE_MS,
    refetchInterval: FLAG_CACHE_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Fail closed: until the answer arrives, every payment surface is off.
  return { flags: query.data ?? defaultFlags(), isLoading: query.isLoading };
}

export function useFlag(key: FlagKey): boolean {
  return useFlags().flags[key];
}
