import type { Problem } from '../types/api';

export function problem(status: number, code: string, title: string, detail?: string, errors?: Problem['errors']): Problem {
  return {
    type: `https://api.greensheet.io/problems/${code}`,
    title,
    status,
    code,
    detail,
    errors,
  };
}

export const GS = {
  GEN_1000: (errors?: Problem['errors']) => problem(400, 'GS-GEN-1000', 'Validation failed', undefined, errors),
  GEN_1003: () => problem(422, 'GS-GEN-1003', 'Idempotency key conflict'),
  GEN_1004: () => problem(400, 'GS-GEN-1004', 'Idempotency key required'),
  GEN_1005: () => problem(404, 'GS-GEN-1005', 'Resource not found'),
  CRM_1001: () => problem(409, 'GS-CRM-1001', 'Roaster already exists'),
  CAT_1001: (detail: string) => problem(409, 'GS-CAT-1001', 'Insufficient inventory', detail),
  CAT_1002: () => problem(409, 'GS-CAT-1002', 'Lot retired'),
  CMP_1003: () => problem(409, 'GS-CMP-1003', 'Rule code in use'),
};
