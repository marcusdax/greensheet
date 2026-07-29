## Fix Report 4

Fixed `rules.patch` in `app/src/api/client.ts` so that both the source and destination campaigns are validated to exist before mutating either `ruleCodes` array. Previously, the source campaign had its ruleCode removed before the destination campaign existence check, leaving the source inconsistent when the destination was missing. Now it returns `GS.GEN_1005()` if either campaign is missing and leaves all state unchanged.

Added regression test in `app/src/api/__tests__/client.test.ts`: patching a rule to a non-existent campaign asserts the response is a problem, the source campaign still contains the ruleCode, and the rule's campaignId is unchanged.

### Verification

```
cd app && npm run test:run -- src/api/__tests__/client.test.ts
> vitest run src/api/__tests__/client.test.ts
✓ src/api/__tests__/client.test.ts (30 tests) 20ms
Test Files  1 passed (1)
Tests  30 passed (30)
```

```
cd app && npm run build
> tsc -b && vite build
✓ built in 2.04s
```

```
cd app && npm run lint
> oxlint
Found 0 warnings and 0 errors.
```
