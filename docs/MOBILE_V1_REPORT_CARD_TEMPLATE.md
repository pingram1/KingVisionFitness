# KingVision Fitness — Mobile V1 readiness report card

This is the **V1 readiness source of truth** for the Expo/React Native client and its companion API scope. Full multi-surface grading lives in [`UNIVERSAL_APP_REPORT_CARD_RUBRIC.md`](./UNIVERSAL_APP_REPORT_CARD_RUBRIC.md); this template keeps only rows that apply to **mobile + backend contract + delivery** for V1.

## How to use

- Fill **Old / New / Evidence** when you complete a milestone (e.g. Tier 2 security, feature cut).
- Use **N/A** for rows that genuinely do not apply (e.g. no web SPA in scope).
- Prefer file paths + PR links as evidence (`src/storage/authTokenStorage.ts`, `.github/workflows/main.yml`).
- Grade scale matches the universal doc (A− = strong minor gaps; C = needs investment).

---

## Blank table (copy for each review)

| Domain & Subcategory | Old | New | Evidence |
|----------------------|-----|-----|----------|
| **Security — Mobile auth storage** | | | Keychain/Knox via `expo-secure-store` + migration from legacy AsyncStorage |
| **Security — AuthN / AuthZ (API trust)** | | | JWT validation, RBAC on protected routes (`backend/src/middleware/auth.ts`) |
| **Security — Transport** | | | TLS in prod; API pinning / allow-listed origins |
| **Security — Secrets (client)** | | | No billing secrets in bundle; config via env / EAS |
| **Security — PII / logging (client)** | | | No tokens in Metro logs; analytics scrub |
| **Testing — Mobile smoke & critical flows** | | | `frontend/scripts/smoke-tests.mjs` (entry + auth wiring); `npm run test:jest` (`authTokenStorage.jest.test.ts`); CI runs both |
| **Testing — API / integration** | | | Backend tests (route + service depth over time) |
| **Testing — CI gates** | | | `.github/workflows/main.yml`: lint + test |
| **Testing — Lint / static analysis** | | | ESLint (Expo config) + API TS ESLint |
| **Architecture — API ↔ client contracts** | | | Error shapes, versioning, pagination if used |
| **Architecture — Client structure** | | | Navigation, context, shared services (`api.ts`) |
| **UX — Auth & session UX** | | | Loading, logout, expired session handling |
| **UX — Accessibility (mobile)** | | | Labels, focus, modal/sheet semantics |
| **UX — Perf (startup / lists)** | | | Lazy routes, image policy, unnecessary re-renders |
| **DevOps — CI** | | | main/develop push workflow |
| **DevOps — Build & release** | | | EAS profiles, versioning, crash reporting hooks |
| **Feature — Groups / tenancy (V1)** | | | Bubble + group isolation modeling (`Bubble`, `Group.bubbleId`) |

---

## Executive summary (each review)

**Strongest improvements (top 3)**  
1.  
2.  
3.  

**Next investments (top 2)**  
1.  
2.  
