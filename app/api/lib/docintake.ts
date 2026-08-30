import type { Context } from "hono";
import { resolveSessionUser } from "../context";
import { env } from "./env";

// Authenticated proxy to the doc-intake FastAPI service. The Python service
// binds to localhost with no auth of its own — every request must pass the
// same session + role gate the tRPC surface enforces.
export async function docintakeProxy(c: Context) {
  const user = await resolveSessionUser(c.req.raw);
  if (!user) {
    return c.json({ error: "GS-AUTH-1001 · unauthenticated" }, 401);
  }
  if (user.role !== "platform_admin" && user.role !== "ops_manager") {
    return c.json({ error: "GS-GEN-1002 · missing scope" }, 403);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${env.docintakeUrl}/extract`, {
      method: "POST",
      body: c.req.raw.body,
      headers: {
        "content-type": c.req.header("content-type") ?? "application/octet-stream",
      },
      // Node fetch requires this when streaming a request body.
      duplex: "half",
    });
  } catch {
    return c.json(
      { error: "GS-DOC-1006 · doc-intake service offline — start services/docintake (uvicorn, port 8100)" },
      502,
    );
  }

  const body = await upstream.text();
  return c.newResponse(body, upstream.status as 200, {
    "content-type": upstream.headers.get("content-type") ?? "application/json",
  });
}
