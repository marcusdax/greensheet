// Runtime configuration — ADR-05.
//
// The flag endpoint is deliberately available to every authenticated role: the
// UI cannot render before it knows which surfaces exist. Changing a flag is
// platform_admin only (contracts/rbac.ts).
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, protectedProcedure, rbacProcedure } from "../middleware";
import { getDb } from "../queries/connection";
import { featureFlags } from "@db/schema";
import { getFlags, invalidateFlagCache } from "../services/flags";
import { FEATURE_FLAGS, FLAG_KEYS, isFlagKey } from "@contracts/flags";
import { emitEvent } from "../engine";

export const configRouter = createRouter({
  flags: rbacProcedure("config.flags").query(async () => getFlags()),

  flagDetail: rbacProcedure("config.flagDetail").query(async () => {
    const flags = await getFlags({ fresh: true });
    return FLAG_KEYS.map((key) => ({
      key,
      enabled: flags[key],
      description: FEATURE_FLAGS[key].description,
      default: FEATURE_FLAGS[key].default,
    }));
  }),

  setFlag: rbacProcedure("config.setFlag")
    .input(
      z.object({
        key: z.string().refine(isFlagKey, "unknown flag"),
        enabled: z.boolean(),
        reason: z.string().min(3).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.featureFlags.findFirst({
        where: eq(featureFlags.flagKey, input.key),
      });

      if (existing) {
        await db
          .update(featureFlags)
          .set({ enabled: input.enabled, updatedByUserId: ctx.user.id })
          .where(eq(featureFlags.id, existing.id));
      } else {
        await db.insert(featureFlags).values({
          flagKey: input.key,
          enabled: input.enabled,
          description: isFlagKey(input.key) ? FEATURE_FLAGS[input.key].description : "",
          updatedByUserId: ctx.user.id,
        });
      }

      // A kill switch that takes 30 seconds to bite is not a kill switch.
      invalidateFlagCache();

      // Flipping settlement off is a material operational act; it leaves a trace.
      await emitEvent("config.flag_changed", "feature_flag", input.key, {
        key: input.key,
        enabled: input.enabled,
        reason: input.reason,
        byUserId: ctx.user.id,
      });

      return { key: input.key, enabled: input.enabled };
    }),
});
