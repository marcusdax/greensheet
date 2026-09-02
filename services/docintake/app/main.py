"""Document intake service — stateless: photo in, structured fields out.
The TypeScript app owns auth, review, and persistence; this service only talks
to the Claude API. Bind to localhost — the Hono backend proxies to it."""

import anthropic
from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .extraction import MODEL, ExtractionRefused, extract
from .schemas import DOC_TYPES

app = FastAPI(title="Auctum Ledger — Doc Intake", version="0.1.0")

ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
LOW_CONFIDENCE_THRESHOLD = 0.7


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "model": MODEL}


@app.post("/extract")
async def extract_document(file: UploadFile, doc_type: str = Form(...)) -> JSONResponse:
    schema = DOC_TYPES.get(doc_type)
    if schema is None:
        raise HTTPException(422, detail=f"GS-DOC-1003 · unknown doc_type '{doc_type}'")
    media_type = (file.content_type or "").lower()
    if media_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(415, detail="GS-DOC-1001 · only JPEG, PNG, or WebP photos are accepted")
    body = await file.read()
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, detail="GS-DOC-1000 · photo exceeds 10 MB — resize to ≤2000px and retry")
    if len(body) == 0:
        raise HTTPException(422, detail="GS-DOC-1000 · empty upload")

    try:
        result = extract(body, media_type, schema)
    except ExtractionRefused as e:
        # Operator falls back to manual entry — the review form supports it.
        raise HTTPException(422, detail=f"GS-DOC-1002 · {e.detail}") from e
    except anthropic.RateLimitError as e:
        raise HTTPException(503, detail="GS-DOC-1004 · extraction rate-limited, retry shortly") from e
    except anthropic.APIStatusError as e:
        raise HTTPException(502, detail=f"GS-DOC-1005 · Claude API error ({e.status_code})") from e
    except anthropic.APIConnectionError as e:
        raise HTTPException(502, detail="GS-DOC-1005 · could not reach the Claude API") from e
    except anthropic.AnthropicError as e:
        # e.g. no credentials configured — set ANTHROPIC_API_KEY in .env
        raise HTTPException(502, detail=f"GS-DOC-1005 · {e}") from e

    fields = result.model_dump()
    low_confidence = sorted(
        name for name, f in fields.items() if f["confidence"] < LOW_CONFIDENCE_THRESHOLD
    )
    return JSONResponse(
        {"doc_type": doc_type, "fields": fields, "low_confidence": low_confidence, "model": MODEL}
    )
