// OCR structured-data schemas and confidence gating — sprint spec §6.
//
// The governing rule is ADR-04: OCR PROPOSES, humans DISPOSE. The pipeline
// never writes an approved business record. It creates a draft with a
// sourceDocumentId and a human with the right role approves it.
//
// v1 gated on a single global confidence threshold and auto-created a QC audit
// at ≥0.90 (G6). That is an OCR engine setting a farmer's revenue-share
// percentage with nobody in the loop. Confidence is now gated per field, by
// what the field is worth.

/** What a wrong value costs, which is the only thing that should set the gate. */
export type FieldCriticality = "financial" | "standard" | "advisory";

export const FIELD_CRITICALITY: Record<string, FieldCriticality> = {
  // ── Financial / quality-critical ─────────────────────────────────────────
  // Always human-confirmed regardless of confidence. A cup score is an input to
  // the revenue-share tier that determines a farmer's payment; no confidence
  // number justifies removing a person from that decision.
  cupScore: "financial",
  moistureContent: "financial",
  defectCount: "financial",
  unitPrice: "financial",
  totalAmount: "financial",
  quantity: "financial",
  bankAccountNumber: "financial",

  // ── Standard ─────────────────────────────────────────────────────────────
  sampleId: "standard",
  lotCode: "standard",
  issuedDate: "standard",
  deliveryWindow: "standard",
  incoterm: "standard",
  contractNumber: "standard",
  counterpartyName: "standard",

  // ── Advisory ─────────────────────────────────────────────────────────────
  sensory: "advisory",
  notes: "advisory",
  varietal: "advisory",
  processMethod: "advisory",
};

export const STANDARD_ACCEPT_THRESHOLD = 0.9;
export const STANDARD_WARN_THRESHOLD = 0.7;

export type FieldGate =
  | { action: "require_confirmation"; prefill: true; reason: string }
  | { action: "accept"; prefill: true; reason: string }
  | { action: "warn"; prefill: true; reason: string }
  | { action: "blank"; prefill: false; reason: string };

/** The whole of §6.2, as a pure function. */
export function gateForField(field: string, confidence: number | undefined): FieldGate {
  const criticality = FIELD_CRITICALITY[field] ?? "standard";

  if (criticality === "financial") {
    return {
      action: "require_confirmation",
      prefill: true,
      reason:
        "financial or quality-critical: pre-filled and highlighted, but the field must be explicitly touched before the form can be accepted (ADR-04)",
    };
  }

  if (criticality === "advisory") {
    return { action: "accept", prefill: true, reason: "advisory: no gate at any confidence" };
  }

  const c = confidence ?? 0;
  if (c >= STANDARD_ACCEPT_THRESHOLD) {
    return { action: "accept", prefill: true, reason: `confidence ${c.toFixed(2)} ≥ 0.90` };
  }
  if (c >= STANDARD_WARN_THRESHOLD) {
    return { action: "warn", prefill: true, reason: `confidence ${c.toFixed(2)} is 0.70–0.89` };
  }
  return { action: "blank", prefill: false, reason: `confidence ${c.toFixed(2)} < 0.70` };
}

/** Fields a human must explicitly touch before the draft can be accepted. */
export function fieldsRequiringConfirmation(fields: Record<string, unknown>): string[] {
  return Object.keys(fields).filter((f) => FIELD_CRITICALITY[f] === "financial");
}

// ─── Document type schemas (versioned) ───────────────────────────────────────

export type OcrExtraction = {
  schemaVersion: number;
  documentType: string;
  fields: Record<string, unknown>;
};

export const OCR_SCHEMA_VERSION = 1;

export const OCR_DOCUMENT_FIELDS: Record<string, string[]> = {
  sca_lab_report: ["sampleId", "lotCode", "cupScore", "moistureContent", "defectCount", "sensory", "notes"],
  sales_contract: [
    "contractNumber",
    "counterpartyName",
    "quantity",
    "unitPrice",
    "totalAmount",
    "incoterm",
    "deliveryWindow",
    "issuedDate",
  ],
  purchase_contract: [
    "contractNumber",
    "counterpartyName",
    "quantity",
    "unitPrice",
    "totalAmount",
    "incoterm",
    "deliveryWindow",
    "issuedDate",
  ],
};

/**
 * Every field present in `fields` must have a confidence entry (§6.3). A field
 * with no confidence would silently take the `standard`/0 path and blank
 * itself, which looks like the OCR failing rather than the contract being
 * violated. Asserted in a test, and here at runtime.
 */
export function assertConfidenceCoverage(
  fields: Record<string, unknown>,
  confidences: Record<string, number>,
): string[] {
  return Object.keys(fields).filter((f) => typeof confidences[f] !== "number");
}

// ─── Upload constraints (§12.3) ──────────────────────────────────────────────
export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const PRESIGNED_URL_TTL_SECONDS = 15 * 60;
