// Environment for the integration tier, set BEFORE any application module is
// imported.
//
// `api/lib/env.ts` snapshots process.env into a frozen object at import time,
// so a test that sets PAYOS_CHECKSUM_KEY in a beforeAll has already lost: the
// module read an empty string when the test file's imports were hoisted. Vitest
// runs setup files ahead of test modules, which is the only place these can go.
// Deliberately NOT falling back to DATABASE_URL. These tests truncate tables;
// the price of that is naming the throwaway schema explicitly, every time.
const url = process.env.INTEGRATION_DATABASE_URL ?? "";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = url;

// Deterministic provider secrets. These are test values and exist only here.
process.env.PAYOS_CHECKSUM_KEY = "integration-payos-checksum-key"; // pragma: allowlist secret
process.env.CASSO_WEBHOOK_SECRET = "integration-casso-webhook-secret"; // pragma: allowlist secret
process.env.CASSO_API_KEY = "integration-casso-api-key"; // pragma: allowlist secret
process.env.CASSO_API_URL = "http://casso.invalid/v2";

// Flags are read from the database and overridden by env outside production
// (ADR-05). Settlement must be ON for these tests; auto-allocation stays OFF,
// because §13.4's posture is what the pilot-allowlist assertions exercise.
process.env.FLAG_VIETQR_PAYMENTS = "1";
process.env.FLAG_AUTO_ALLOCATION = "0";

process.env.MERCHANT_BANK_BIN = "970436";
process.env.MERCHANT_BANK_NAME = "Vietcombank";
process.env.MERCHANT_ACCOUNT_NUMBER = "0071000123456";
process.env.MERCHANT_NAME = "AUCTUM TEST";
