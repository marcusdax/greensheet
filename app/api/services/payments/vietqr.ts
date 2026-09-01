// VietQR / EMVCo payload construction — sprint spec §8.3.
//
// The QR a payer scans is an EMVCo TLV string, not a URL. Building it here
// rather than depending on a provider endpoint means the payment screen renders
// even when PayOS is unreachable, and the fallback path in §8.3 — "some payers
// will type the transfer manually" — has the same account details behind it.
//
// TLV: two-digit tag, two-digit length, value. Nested templates hold TLVs of
// their own. The final tag 63 is a CRC-16/CCITT-FALSE over everything before
// it, INCLUDING its own tag and length field.

/** NAPAS-assigned GUID for the VietQR merchant account template. */
export const VIETQR_GUID = "A000000727";
/** ISO 4217 numeric codes — the QR uses the number, not the letter code. */
const NUMERIC_CURRENCY: Record<string, string> = { VND: "704", USD: "840" };

export type VietQrInput = {
  /** NAPAS bank identification number, e.g. "970415" for VietinBank. */
  bankBin: string;
  accountNumber: string;
  /** Minor units. VND exponent is 0, so this is already the đồng figure. */
  amountMinor?: bigint;
  currency?: string;
  /** The memo token. Goes in tag 62-08, which is what the bank shows the payer. */
  addInfo?: string;
  /** Optional; some banks render it, most truncate it. */
  merchantName?: string;
  merchantCity?: string;
};

export function tlv(tag: string, value: string): string {
  if (tag.length !== 2)
    throw new Error(`EMVCo tag must be two digits, got "${tag}"`);
  if (value.length > 99) {
    throw new Error(
      `EMVCo value for tag ${tag} exceeds 99 characters (${value.length})`
    );
  }
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

/**
 * CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no reflection,
 * no final XOR. Rendered as four uppercase hex digits.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildVietQrPayload(input: VietQrInput): string {
  const currency = input.currency ?? "VND";
  const numericCurrency = NUMERIC_CURRENCY[currency];
  if (!numericCurrency) {
    throw new Error(`GS-PAY-1023 · VietQR cannot encode ${currency}`);
  }
  if (!/^\d{6}$/.test(input.bankBin)) {
    throw new Error(
      `GS-PAY-1024 · bank BIN must be six digits, got "${input.bankBin}"`
    );
  }

  // 38 — merchant account information, VietQR template.
  const beneficiary = tlv("00", input.bankBin) + tlv("01", input.accountNumber);
  const merchantAccount =
    tlv("00", VIETQR_GUID) + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");

  const parts = [
    tlv("00", "01"), // payload format indicator
    // 11 = static (payer types the amount), 12 = dynamic (amount is fixed).
    tlv("01", input.amountMinor === undefined ? "11" : "12"),
    tlv("38", merchantAccount),
    tlv("53", numericCurrency),
  ];

  if (input.amountMinor !== undefined) {
    if (input.amountMinor <= 0n)
      throw new Error("GS-PAY-1025 · QR amount must be > 0");
    parts.push(tlv("54", formatQrAmount(input.amountMinor, currency)));
  }

  parts.push(tlv("58", "VN"));
  if (input.merchantName)
    parts.push(tlv("59", truncate(input.merchantName, 25)));
  if (input.merchantCity)
    parts.push(tlv("60", truncate(input.merchantCity, 15)));

  if (input.addInfo) {
    // 62-08 is the transfer description — where the memo token lives, and the
    // reason it is only ten uppercase alphanumeric characters (§7.1).
    parts.push(tlv("62", tlv("08", truncate(input.addInfo, 25))));
  }

  const withoutCrc = `${parts.join("")}6304`;
  return `${withoutCrc}${crc16(withoutCrc)}`;
}

/** Verify a payload's own checksum — used by the round-trip test. */
export function verifyVietQrPayload(payload: string): boolean {
  if (payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const checksum = payload.slice(-4);
  if (!body.endsWith("6304")) return false;
  return crc16(body) === checksum.toUpperCase();
}

/** The QR carries the amount in MAJOR units, unlike everything else here. */
function formatQrAmount(amountMinor: bigint, currency: string): string {
  if (currency === "VND") return amountMinor.toString();
  const major = amountMinor / 100n;
  const minor = (amountMinor % 100n).toString().padStart(2, "0");
  return `${major}.${minor}`;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
