// §9 — "design-system compliance: zero arbitrary colors in Trust / Scanner
// components (CI token check)".
//
// This is that check. It is a test rather than a lint rule because the rule is
// not "never write a hex" — it is "these particular surfaces must consume the
// Museum Folio palette", and the list of which surfaces those are is a design
// decision worth reading in one place.
//
// The pre-existing screens are deliberately NOT in scope. Retrofitting every
// hex in the app is a separate change; failing this test on files this spec
// never touched would just teach people to skip it.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { BAND_SPECS, TRUST_BANDS } from "@contracts/trust";

const ROOT = join(__dirname, "..");

/** Surfaces the Trust & Scanner spec governs. */
const GOVERNED_FILES = [
  "contracts/trust.ts",
  "src/components/TrustBadge.tsx",
  "src/components/TrustPanel.tsx",
  "src/components/ScannerSurface.tsx",
  "src/components/ReviewPane.tsx",
  // Education & Partners (cupping SOP §1, supplier clauses §B–§E).
  "contracts/cupping-authority.ts",
  "src/components/CupperCard.tsx",
  "src/components/DispositionPanel.tsx",
];

/** Hex literals anywhere in the file. */
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/**
 * The Tailwind arbitrary-value escape hatch, restricted to COLOUR values.
 *
 * §9 asks for "zero arbitrary colors", not zero arbitrary values. `text-[11px]`
 * is a font size on a utility that also takes colours, and flagging it would
 * push people to disable the check rather than fix a colour — so this matches
 * only what actually looks like a colour: a hex literal or an rgb/hsl/oklch
 * function. A dimension with a unit is left alone.
 */
const ARBITRARY =
  /\b(?:bg|text|border|fill|stroke|ring|from|to|via|decoration|outline|shadow|accent|caret|divide)-\[\s*(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|color|oklch|lab)\()[^\]]*\]/g;

function read(file: string): string | null {
  const path = join(ROOT, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

describe("Museum Folio token compliance (§9)", () => {
  it("has every governed file present", () => {
    const missing = GOVERNED_FILES.filter(f => read(f) === null);
    expect(
      missing,
      `these files are named in the token check but do not exist: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("uses no raw hex colours in Trust or Scanner components", () => {
    const offenders: string[] = [];
    for (const file of GOVERNED_FILES) {
      const source = read(file);
      if (source === null) continue;
      for (const match of source.match(HEX) ?? []) {
        offenders.push(`${file}: ${match}`);
      }
    }
    expect(
      offenders,
      `use a Museum Folio token instead of a literal colour:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("uses no Tailwind arbitrary colour values either", () => {
    // bg-[#8C2F22] is the same problem wearing a bracket.
    const offenders: string[] = [];
    for (const file of GOVERNED_FILES) {
      const source = read(file);
      if (source === null) continue;
      for (const match of source.match(ARBITRARY) ?? []) {
        offenders.push(`${file}: ${match}`);
      }
    }
    expect(
      offenders,
      `arbitrary Tailwind values: ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("gives every band a class built from registered token names", () => {
    // The band classes live in contracts/, which Tailwind is configured to
    // scan. If someone renames a token without updating the config, these
    // classes silently purge and the badge renders unstyled — so the names are
    // asserted here rather than trusted.
    const registered = readFileSync(join(ROOT, "tailwind.config.js"), "utf8");
    const scales = [
      "brass",
      "sage",
      "oxblood",
      "neutral",
      "danger",
      "ink",
      "paper",
    ];
    for (const scale of scales) {
      expect(
        registered,
        `tailwind.config.js does not register "${scale}"`
      ).toContain(`${scale}:`);
    }
    for (const band of TRUST_BANDS) {
      const className = BAND_SPECS[band].className;
      expect(className, `${band} has no colour class`).not.toBe("");
      expect(className, `${band} uses a raw hex`).not.toMatch(HEX);
      expect(className, `${band} uses an arbitrary value`).not.toMatch(
        ARBITRARY
      );
    }
  });

  it("defines every Museum Folio token in both light and dark", () => {
    const css = readFileSync(join(ROOT, "src/index.css"), "utf8");
    // A token defined only in :root renders as an unresolved var in dark mode,
    // which paints transparent — a Trust badge with no background at all.
    const tokens = [
      "--ink-900",
      "--paper-50",
      "--brass-300",
      "--sage-600",
      "--oxblood-100",
      "--oxblood-700",
      "--neutral-700",
      "--danger",
      "--danger-tint",
    ];
    const darkBlock = css.slice(css.indexOf(".dark {"));
    for (const token of tokens) {
      expect(css, `${token} is not defined`).toContain(`${token}:`);
      expect(darkBlock, `${token} has no dark-mode value`).toContain(
        `${token}:`
      );
    }
  });
});
