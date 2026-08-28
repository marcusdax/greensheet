import { createRouter, publicQuery } from "./middleware";
import { catalogRouter } from "./routers/catalog";
import { crmRouter } from "./routers/crm";
import { samplesRouter } from "./routers/samples";
import { ordersRouter } from "./routers/orders";
import { campaignsRouter, analyticsRouter } from "./routers/campaigns";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  catalog: catalogRouter,
  crm: crmRouter,
  samples: samplesRouter,
  orders: ordersRouter,
  campaigns: campaignsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
