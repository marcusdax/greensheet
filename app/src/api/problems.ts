import type { Problem } from '../types/api';

export function problem(status: number, code: string, title: string, detail?: string, errors?: Problem['errors']): Problem {
  return {
    type: `https://api.auctum.io/problems/${code}`,
    title,
    status,
    code,
    detail,
    errors,
  };
}

export const AL = {
  GEN_1000: (errors?: Problem['errors']) => problem(400, 'AL-GEN-1000', 'Validation failed', undefined, errors),
  GEN_1003: () => problem(422, 'AL-GEN-1003', 'Idempotency key conflict'),
  GEN_1004: () => problem(400, 'AL-GEN-1004', 'Idempotency key required'),
  GEN_1005: () => problem(404, 'AL-GEN-1005', 'Resource not found'),
  CRM_1001: () => problem(409, 'AL-CRM-1001', 'Roaster already exists'),
  CAT_1001: (detail: string) => problem(409, 'AL-CAT-1001', 'Insufficient inventory', detail),
  CAT_1002: () => problem(409, 'AL-CAT-1002', 'Lot retired'),
  CMP_1003: () => problem(409, 'AL-CMP-1003', 'Rule code in use'),
  REF_1001: (detail: string) => problem(409, 'AL-REF-1001', 'Referral code already taken', detail),
  REF_1002: (detail: string) => problem(404, 'AL-REF-1002', 'Referral code not found', detail),
  REF_1003: (detail: string) => problem(404, 'AL-REF-1003', 'Referral not found', detail),
  REF_1004: () => problem(400, 'AL-REF-1004', 'Referral not qualified'),
  REF_1005: (detail: string) => problem(403, 'AL-REF-1005', 'Referral did not qualify', detail),
  REF_1006: (detail: string) => problem(422, 'AL-REF-1006', 'Referral requires manual review', detail),
  REF_1007: (detail: string) => problem(422, 'AL-REF-1007', 'Referral rewards auto-paused for review', detail),
  REF_1008: (detail: string) => problem(422, 'AL-REF-1008', 'Referral not in review queue', detail),
};
