# Doc Intake Service

Photograph a supplier offer sheet or a CMR consignment note; get back structured,
per-field-confidence JSON ready for the review screen in the Auctum Ledger app.
Adapted from the `vision-ocr-ai-agent-logistics` concept — extraction is powered
by the Claude API (`claude-opus-5` vision + structured outputs) instead of
locally hosted OCR models, so there is no PyTorch/GPU footprint.

## Run

```bash
cd services/docintake
cp .env.example .env          # set ANTHROPIC_API_KEY
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8100
```

`GET /healthz` → `{"ok": true, "model": "claude-opus-5"}`.

The app's Hono backend proxies `POST /api/docintake/extract` here (see
`app/api/lib/docintake.ts`), enforcing the session cookie and role check before
anything reaches this service. Bind to `127.0.0.1` — the service itself has no
auth. Set `DOCINTAKE_URL` in `app/.env` if the port differs from 8100.

## API

`POST /extract` — multipart form:

| field      | value                                          |
|------------|------------------------------------------------|
| `file`     | JPEG/PNG/WebP photo, ≤10 MB                    |
| `doc_type` | `lot_offer` or `cmr_shipping`                  |

Response: `{ doc_type, fields: {name: {value, confidence}, …}, low_confidence: [...], model }`.
Fields under 0.7 confidence are listed in `low_confidence`; the review UI flags
them. Confidence is model-asserted, not calibrated — **nothing auto-commits**;
a human confirms every field before the app writes to the ledger.

## Error codes

| code        | HTTP | meaning                                   |
|-------------|------|-------------------------------------------|
| GS-DOC-1000 | 413/422 | photo too large (>10 MB) or empty      |
| GS-DOC-1001 | 415  | unsupported media type                    |
| GS-DOC-1002 | 422  | model declined (refusal) — enter manually |
| GS-DOC-1003 | 422  | unknown doc_type                          |
| GS-DOC-1004 | 503  | rate-limited, retry shortly               |
| GS-DOC-1005 | 502  | upstream Claude API error                 |

## Notes

- Large phone photos: resize client-side to ≤2000 px on the long edge before
  uploading — faster and cheaper, and 10 MB is a hard cap.
- Refusal fallbacks: the service uses the stable `client.messages.parse`
  namespace, which validates output against the Pydantic schema. The Claude
  API's server-side refusal fallbacks (`betas=["server-side-fallback-2026-07-01"],
  fallbacks="default"`) live on the beta namespace; if refusal volume ever
  matters, switch to `client.beta.messages` and add them — for now a refusal
  surfaces as GS-DOC-1002 and the operator enters fields manually.
- `claude-opus-5` requires an org configured for 30-day data retention.
