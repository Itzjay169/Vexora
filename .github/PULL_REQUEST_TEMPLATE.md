## Description & Scope
<!-- Provide a concise summary of the changes made and link the relevant GitHub issue or Phase milestone. -->
- **Phase Milestone**: Phase [X]: [Phase Name]
- **Target Component**: [backend / apps/mobile / apps/web / apps/admin / packages / infra / docs]
- **Related Issue**: Closes #[Issue Number]

---

## MCP Tooling Usage Log (Blueprint Section 38 Mandatory)
<!-- Check every MCP server utilized during this change to allow targeted security review. -->
- [ ] `Filesystem` (Workspace file generation & editing)
- [ ] `Context7` (API documentation & version verification)
- [ ] `Postgres` (Read-only schema and query verification on DEV/STAGING)
- [ ] `GitHub` (Branch, issue, and PR management)
- [ ] `Firebase` (Auth, FCM, App Check dev configuration)
- [ ] `Playwright` (E2E browser tests with test accounts)
- [ ] `Dart MCP` (Flutter UI, analysis & tests)
- [ ] `Stitch` (UI designs & token exports)
- [ ] `Developer Knowledge` (Google developer documentation query)

---

## Security Gate Checklist (Golden Rules)
- [ ] **No Secrets**: Verified no API keys, private passwords, tokens, or credentials are committed.
- [ ] **Data Minimisation**: No private PII (real phone numbers, KYC docs, unhashed passwords) committed or exposed in logs.
- [ ] **Input Validation**: All mutation endpoints validated with strict Zod / DTO schemas.
- [ ] **Idempotency**: All mutation actions require and enforce `Idempotency-Key`.
- [ ] **Ledger Integrity**: No direct balance updates (`UPDATE/DELETE` forbidden on ledger transactions).
- [ ] **Audit Logging**: Sensitive actions emit tamper-evident audit log entries.
- [ ] **Row-Level Security**: Proper authorization checks prevent horizontal privilege escalation.

---

## Testing & Verification
<!-- Describe the tests executed and attach relevant outputs or screenshots. -->
- [ ] Unit Tests: `npm test` (all passing)
- [ ] Integration / Smoke Tests: passed
- [ ] Linting & Type Checking: `npm run lint` / `npm run type-check` (0 errors)
- [ ] E2E / Playwright Tests (if UI touched): passed
