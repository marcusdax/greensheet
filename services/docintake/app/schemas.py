"""Extraction schemas — every field carries a model-asserted confidence so the
review UI can flag what a human must double-check before anything commits."""

from pydantic import BaseModel, Field as PydanticField


class StrField(BaseModel):
    value: str | None = PydanticField(description="Extracted text, or null if absent/illegible")
    confidence: float = PydanticField(ge=0, le=1, description="0–1 confidence in the value")


class NumField(BaseModel):
    value: float | None = PydanticField(description="Extracted number, or null if absent/illegible")
    confidence: float = PydanticField(ge=0, le=1, description="0–1 confidence in the value")


class LotOfferExtraction(BaseModel):
    """Supplier offer sheet → fields matching the catalog.register contract."""

    name: StrField = PydanticField(description="Lot name / title, e.g. 'Yirgacheffe G1 — Kochere'")
    origin: StrField = PydanticField(description="Country of origin")
    region: StrField = PydanticField(description="Growing region / zone")
    varietal: StrField = PydanticField(description="Coffee varietal(s)")
    process_method: StrField = PydanticField(description="Processing method, e.g. Washed, Natural")
    flavor_notes: StrField = PydanticField(description="Cupping / flavor notes as written")
    elevation_meters: NumField = PydanticField(description="Elevation in meters above sea level")
    cup_score: NumField = PydanticField(description="SCA cup score, 0–100")
    price_per_lb_usd: NumField = PydanticField(description="Offer price in USD per pound (convert from per-kg if needed: 1 kg = 2.20462 lb)")
    cost_per_lb_usd: NumField = PydanticField(description="Cost basis in USD per pound if stated, else null")
    available_lbs: NumField = PydanticField(description="Available quantity in pounds (convert from kg or bags if stated)")
    total_production_lbs: NumField = PydanticField(description="Total production in pounds if stated, else null")


class CmrExtraction(BaseModel):
    """CMR consignment note / shipping document → warehouse intake fields."""

    consignor: StrField = PydanticField(description="Consignor / sender name (CMR box 1)")
    consignee: StrField = PydanticField(description="Consignee / receiver name (CMR box 2)")
    container_number: StrField = PydanticField(description="Container number, e.g. MSKU1234567")
    seal_number: StrField = PydanticField(description="Seal number")
    gross_weight_lbs: NumField = PydanticField(description="Gross weight in pounds (convert from kg: 1 kg = 2.20462 lb)")
    shipped_date: StrField = PydanticField(description="Ship / dispatch date as ISO 8601 (YYYY-MM-DD), or null")
    arrival_date: StrField = PydanticField(description="Arrival / delivery date as ISO 8601 (YYYY-MM-DD), or null")


DOC_TYPES = {
    "lot_offer": LotOfferExtraction,
    "cmr_shipping": CmrExtraction,
}
