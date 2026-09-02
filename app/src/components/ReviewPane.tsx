// OCR review pane — spec §5.4.
//
// Side-by-side: the original on the left, the extracted fields on the right.
// The layout is the argument — an operator confirming a cup score should be
// able to look at the number on the page and the number in the box without
// scrolling between them.
//
// Two rules from ADR-04 that this component enforces rather than assumes:
//
//   · A financial or quality-critical field is never accepted on confidence
//     alone. It must be touched, whatever the model claims, and the primary
//     button stays disabled until it has been.
//   · Low-confidence fields are focused in sequence, so the operator's
//     attention goes where the model is least sure rather than top to bottom.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  FIELD_CRITICALITY,
  STANDARD_ACCEPT_THRESHOLD,
  STANDARD_WARN_THRESHOLD,
  gateForField,
} from "@contracts/ocr-schemas";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export type ReviewField = {
  name: string;
  label: string;
  value: string;
  confidence: number | undefined;
  type?: string;
};

/**
 * §5.4 — green ≥0.85, amber 0.70–0.84, red <0.70.
 *
 * Note the mismatch with ADR-04's own 0.90 accept threshold, which is
 * deliberate on the spec's part: the badge is a reading aid and the gate is a
 * rule. A field at 0.87 is worth a green chip and still is not auto-accepted if
 * it is financial. The gate, not the chip, decides what the form permits.
 */
const BADGE_GREEN = 0.85;

function ConfidenceBadge({ confidence }: { confidence: number | undefined }) {
  if (confidence === undefined) return null;
  const pct = `${Math.round(confidence * 100)}%`;
  const tone =
    confidence >= BADGE_GREEN
      ? "bg-sage-600 text-white"
      : confidence >= STANDARD_WARN_THRESHOLD
        ? "bg-brass-500 text-ink-900"
        : "bg-danger text-white";
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        tone
      )}
      title={`Model confidence ${pct}. Confidence is asserted by the extractor, not measured — it is a hint about where to look, not a guarantee.`}
    >
      {pct}
    </span>
  );
}

export type ReviewPaneProps = {
  /** Object URL of the page being reviewed, or null when it cannot be shown. */
  imageUrl: string | null;
  fields: ReviewField[];
  onChange: (name: string, value: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onReprocess?: () => void;
  acceptLabel?: string;
  busy?: boolean;
};

export function ReviewPane({
  imageUrl,
  fields,
  onChange,
  onAccept,
  onReject,
  onReprocess,
  acceptLabel = "Accept & link",
  busy = false,
}: ReviewPaneProps) {
  const [zoom, setZoom] = useState(1);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const inputs = useRef(new Map<string, HTMLInputElement>());

  /** Fields ADR-04 says a human must touch no matter what the model claims. */
  const mustTouch = useMemo(
    () =>
      fields
        .filter(f => FIELD_CRITICALITY[f.name] === "financial")
        .map(f => f.name),
    [fields]
  );

  /** Where the model was least sure, worst first — the §5.4 focus order. */
  const attentionOrder = useMemo(
    () =>
      fields
        .filter(
          f =>
            (f.confidence ?? 1) < STANDARD_ACCEPT_THRESHOLD ||
            FIELD_CRITICALITY[f.name] === "financial"
        )
        .sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1))
        .map(f => f.name),
    [fields]
  );

  // Focus the first field needing attention when a new extraction arrives.
  useEffect(() => {
    const first = attentionOrder[0];
    if (first) inputs.current.get(first)?.focus();
    // Only on a genuinely new document, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const outstanding = mustTouch.filter(n => !touched.has(n));
  const canAccept = outstanding.length === 0 && !busy;

  function markTouched(name: string) {
    setTouched(prev => (prev.has(name) ? prev : new Set(prev).add(name)));
  }

  /** Move to the next field that still needs attention, or accept. */
  function advanceFrom(name: string) {
    const remaining = attentionOrder.filter(n => n !== name && !touched.has(n));
    const next = remaining[0];
    if (next) {
      inputs.current.get(next)?.focus();
      return;
    }
    if (canAccept) onAccept();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Left — the original. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-neutral-500">
            Original
          </Label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom(z => Math.max(1, z - 0.25))}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom(z => Math.min(4, z + 0.25))}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[32rem] overflow-auto rounded-md border border-neutral-200 bg-paper-100 p-2">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Document being reviewed"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
              className="rounded-sm bg-paper-50"
            />
          ) : (
            // Honest about the gap rather than showing an empty frame: object
            // storage is not wired yet, so a document reviewed later cannot be
            // shown next to its fields.
            <p className="p-8 text-center text-xs text-neutral-500">
              The original is not available to display. Fields can still be
              reviewed, but confirm them against the paper copy.
            </p>
          )}
        </div>
      </div>

      {/* Right — the fields. */}
      <div className="space-y-3">
        {fields.map(f => {
          const gate = gateForField(f.name, f.confidence);
          const needsTouch = FIELD_CRITICALITY[f.name] === "financial";
          const low = (f.confidence ?? 1) < STANDARD_WARN_THRESHOLD;
          const untouched = needsTouch && !touched.has(f.name);
          return (
            <div
              key={f.name}
              className={cn(
                "rounded-md px-2 py-1.5",
                // §5.4 — a soft warning tint, not a red border on everything.
                (low || untouched) && "bg-brass-300/20"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <Label htmlFor={`rp-${f.name}`} className="text-xs">
                  {f.label}
                  {needsTouch && (
                    <span
                      className="ml-1 text-oxblood-500"
                      title="Financial or quality-critical: a person confirms this whatever the model's confidence (ADR-04)."
                    >
                      *
                    </span>
                  )}
                </Label>
                <ConfidenceBadge confidence={f.confidence} />
              </div>
              <Input
                id={`rp-${f.name}`}
                type={f.type ?? "text"}
                value={f.value}
                ref={el => {
                  if (el) inputs.current.set(f.name, el);
                  else inputs.current.delete(f.name);
                }}
                onChange={e => {
                  markTouched(f.name);
                  onChange(f.name, e.target.value);
                }}
                onBlur={() => markTouched(f.name)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    markTouched(f.name);
                    advanceFrom(f.name);
                  }
                }}
                className={cn(low && "border-danger focus-visible:ring-danger")}
              />
              {gate.action === "blank" && (
                <p className="mt-1 text-[11px] text-danger">
                  Left blank on purpose — {gate.reason}
                </p>
              )}
            </div>
          );
        })}

        {outstanding.length > 0 && (
          <p className="text-xs text-oxblood-700">
            Confirm {outstanding.length} critical field
            {outstanding.length === 1 ? "" : "s"} before accepting:{" "}
            {outstanding.join(", ")}.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={onAccept} disabled={!canAccept}>
            {busy ? "Saving…" : acceptLabel}
          </Button>
          <Button variant="outline" onClick={onReject} disabled={busy}>
            Reject
          </Button>
          {onReprocess && (
            <Button variant="ghost" onClick={onReprocess} disabled={busy}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reprocess
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
