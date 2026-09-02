import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { catalogRouter } from "./routers/catalog";
import { crmRouter } from "./routers/crm";
import { samplesRouter } from "./routers/samples";
import { ordersRouter } from "./routers/orders";
import { campaignsRouter } from "./routers/campaigns";
import { analyticsRouter } from "./routers/analytics";
import { warehouseRouter } from "./routers/warehouse";
import { qcRouter } from "./routers/qc";
import { partnersRouter } from "./routers/partners";
import { commsRouter } from "./routers/comms";
import { educationRouter } from "./routers/education";
import { growthRouter } from "./routers/growth";
import { configRouter } from "./routers/config";
import { invoicesRouter } from "./routers/invoices";
import { paymentsRouter } from "./routers/payments";
import { documentsRouter } from "./routers/documents";
import { standingOrdersRouter } from "./routers/standing-orders";
import { trustRouter } from "./routers/trust";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  catalog: catalogRouter,
  crm: crmRouter,
  samples: samplesRouter,
  orders: ordersRouter,
  campaigns: campaignsRouter,
  analytics: analyticsRouter,
  warehouse: warehouseRouter,
  qc: qcRouter,
  partners: partnersRouter,
  comms: commsRouter,
  education: educationRouter,
  growth: growthRouter,
  // Vietnam Payment & Coffee Business Manager sprint (slices 0–3).
  config: configRouter,
  invoices: invoicesRouter,
  payments: paymentsRouter,
  documents: documentsRouter,
  // §3.6 recurring B2B subscriptions.
  standingOrders: standingOrdersRouter,
  // Trust Score — the honesty layer.
  trust: trustRouter,
});

export type AppRouter = typeof appRouter;
