// The memo token — sprint spec §7.1.
//
// Matching happens on the bank transfer description, and the field is hostile:
// Vietnamese banks uppercase it, strip diacritics, and truncate it; PayOS's own
// description budget is around 25 characters; Casso's reference integration
// parses a fixed prefix plus digits. So the token is short, uppercase,
// alphanumeric, and self-checking.
//
// Shape: AUC + 6 payload characters + 1 check character = 10 characters.
// Alphabet is Crockford base32, which excludes I, L, O and U — the four
// characters a human retyping a memo from a printed invoice confuses.

/** Crockford base32: no I, L, O, U. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PREFIX = "AUC";
const PAYLOAD_LENGTH = 6;
export const MEMO_TOKEN_LENGTH = 10; // PREFIX + PAYLOAD + CHECK
export const MAX_ENCODABLE_INVOICE_ID = 32 ** PAYLOAD_LENGTH - 1; // 1,073,741,823

/** Anything outside the alphabet is noise a bank may have inserted. */
const TOKEN_PATTERN = new RegExp(
  `${PREFIX}[${ALPHABET}]{${PAYLOAD_LENGTH + 1}}`,
  "g"
);

export class MemoTokenError extends Error {}

function encodePayload(invoiceId: number): string {
  if (!Number.isInteger(invoiceId) || invoiceId < 0) {
    throw new MemoTokenError(
      `invoice id must be a non-negative integer, got ${invoiceId}`
    );
  }
  if (invoiceId > MAX_ENCODABLE_INVOICE_ID) {
    throw new MemoTokenError(
      `invoice id ${invoiceId} exceeds the ${PAYLOAD_LENGTH}-character memo payload`
    );
  }
  let n = invoiceId;
  let out = "";
  for (let i = 0; i < PAYLOAD_LENGTH; i++) {
    out = ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

/**
 * Check character over the payload. A single mistyped or transposed character
 * fails the check, so a corrupted memo lands in the exception queue instead of
 * crediting the wrong invoice.
 */
function checkChar(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const value = ALPHABET.indexOf(payload[i]);
    if (value < 0)
      throw new MemoTokenError(
        `character "${payload[i]}" is not in the alphabet`
      );
    sum += value * (i + 1); // position-weighted, so transpositions are caught
  }
  return ALPHABET[sum % 32];
}

export function memoTokenFor(invoiceId: number): string {
  const payload = encodePayload(invoiceId);
  return `${PREFIX}${payload}${checkChar(payload)}`;
}

export function isValidMemoToken(token: string): boolean {
  if (token.length !== MEMO_TOKEN_LENGTH) return false;
  if (!token.startsWith(PREFIX)) return false;
  const payload = token.slice(PREFIX.length, PREFIX.length + PAYLOAD_LENGTH);
  const check = token.slice(PREFIX.length + PAYLOAD_LENGTH);
  if ([...payload].some(c => !ALPHABET.includes(c))) return false;
  return checkChar(payload) === check;
}

/** Decode a valid token back to its invoice id, or null if the check fails. */
export function invoiceIdFromMemoToken(token: string): number | null {
  if (!isValidMemoToken(token)) return null;
  const payload = token.slice(PREFIX.length, PREFIX.length + PAYLOAD_LENGTH);
  return [...payload].reduce((acc, c) => acc * 32 + ALPHABET.indexOf(c), 0);
}

/**
 * Normalise a bank memo for matching: uppercase, strip diacritics (banks do
 * this themselves, inconsistently), and drop every non-alphanumeric character
 * so "AUC-1234 56X" and "auc123456x" are the same token.
 */
export function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Every well-formed token in a memo. More than one means the payer pasted two
 * references and the transaction is ambiguous, not matched — that distinction
 * is the difference between crediting the right invoice and guessing (§7.1).
 */
export function extractMemoTokens(description: string): string[] {
  const normalized = normalizeDescription(description);
  const found = normalized.match(TOKEN_PATTERN) ?? [];
  return [...new Set(found.filter(isValidMemoToken))];
}
