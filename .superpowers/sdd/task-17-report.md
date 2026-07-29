# Task 17 Report: Wire routes and navigation

## Summary

Updated routing and sidebar navigation for the Greensheet frontend expansion.

## Changes Made

- `app/src/App.tsx`
  - Changed route path from `rules` to `automation-rules` for `AutomationRulesPage`.
  - Existing imports for `SampleKitsPage`, `OrdersPage`, `AutomationRulesPage`, `WebhooksPage`, and `ReservationsPage` were already present; no duplicate imports added.

- `app/src/components/AppLayout.tsx`
  - Updated `lucide-react` imports: added `Layers` and `Sparkles`; removed `ClipboardList`.
  - Restructured sidebar menu groups to match the brief:
    - **SOURCE**: Navigator, Catalog, Reservations (icon: `Layers`)
    - **ENGAGE**: Campaigns, Automation Rules (icon: `Sparkles`)
    - **RELATIONSHIPS**: Roasters, Sample Kits, Orders
    - **INTELLIGENCE**: Analytics, Webhooks
  - Removed the separate **INTEGRATIONS** group and placed Webhooks under **INTELLIGENCE**.

- `app/src/App.test.tsx` (new)
  - Added a smoke test that renders `AppLayout` inside a `MemoryRouter` route tree.
  - Verifies all 10 sidebar navigation links are present.
  - Verifies that a routed page (`/en-US/automation-rules`) renders without error.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Tests | `npm run test:run -- src/App.test.tsx src/pages/__tests__` | ✅ 10 files, 34 tests passed |
| Build | `npm run build` | ✅ Built successfully (chunk-size warning only) |
| Lint | `npm run lint` | ✅ 0 warnings, 0 errors |

## Commit

- Branch: `feature/greensheet-frontend-expansion`
- Status: Changes staged and committed as part of this task.
