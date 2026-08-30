"""Claude-powered extraction. One vision call per document via the official
Anthropic SDK: messages.parse validates the response against the Pydantic
schema, so what leaves this module is always well-formed."""

import base64

import anthropic
from pydantic import BaseModel

from .config import settings
from .schemas import CmrExtraction, LotOfferExtraction

MODEL = "claude-opus-5"

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)
    return _client


class ExtractionRefused(Exception):
    """The safety layer declined the request (stop_reason == 'refusal')."""

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


PROMPTS: dict[type[BaseModel], str] = {
    LotOfferExtraction: (
        "This photo shows a green-coffee supplier offer sheet. Extract the lot "
        "details into the schema. Report numbers in the requested units, "
        "converting where the document uses kg or bags (1 kg = 2.20462 lb; "
        "assume 60 kg per bag if bag weight is not stated, and lower the "
        "confidence accordingly). For every field give a confidence between 0 "
        "and 1 reflecting how certain you are of the value as read from THIS "
        "document — use null with confidence 0 when a field is absent or "
        "illegible. Never guess values that are not on the document."
    ),
    CmrExtraction: (
        "This photo shows a CMR international consignment note or similar "
        "shipping document. Extract the consignment details into the schema. "
        "Convert weights to pounds (1 kg = 2.20462 lb) and dates to ISO 8601 "
        "(YYYY-MM-DD). For every field give a confidence between 0 and 1 "
        "reflecting how certain you are of the value as read from THIS "
        "document — use null with confidence 0 when a field is absent or "
        "illegible. Never guess values that are not on the document."
    ),
}


def extract(image_bytes: bytes, media_type: str, schema: type[BaseModel]) -> BaseModel:
    client = get_client()
    response = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        },
                    },
                    {"type": "text", "text": PROMPTS[schema]},
                ],
            }
        ],
        output_format=schema,
    )
    if response.stop_reason == "refusal":
        detail = "extraction declined by the model's safety layer"
        if response.stop_details is not None and response.stop_details.explanation:
            detail = response.stop_details.explanation
        raise ExtractionRefused(detail)
    return response.parsed_output
