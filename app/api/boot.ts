import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { docintakeProxy } from "./lib/docintake";
import { payosWebhook } from "./webhooks/payos";
import { cassoWebhook } from "./webhooks/casso";
import { momoWebhook } from "./webhooks/momo";
import { zalopayWebhook } from "./webhooks/zalopay";
import { startOutboxConsumer } from "./services/outbox/consumer";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.post("/api/docintake/extract", docintakeProxy);

// Provider webhooks are plain Hono routes mounted BEFORE the tRPC middleware
// (sprint spec §7.2, B7). tRPC expects its own request envelope and consumes
// the body; a provider posts its own JSON shape, so routing these through tRPC
// would 400 on every real callback.
app.post("/webhooks/payos", payosWebhook);
app.post("/webhooks/casso", cassoWebhook);
app.post("/webhooks/momo", momoWebhook);
app.post("/webhooks/zalopay", zalopayWebhook);
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // The outbox consumer polls only while the `outboxConsumer` flag is on; until
  // then engine.ts still evaluates rules inline (§4.1 migration safety).
  startOutboxConsumer();
}
