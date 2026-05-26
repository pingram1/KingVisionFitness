# KingVision Fitness — Enterprise Readiness Audit

**Date:** 2026-05-26
**Scope:** Backend (Node.js/Express/MongoDB) + Frontend (React Native/Expo) at `kingvision-fitness/`
**Method:** Four parallel read-only explore subagents, one per pillar (testing, security, performance, CI/CD).
**Skills toolkit:** 65 skills installed from [`spencerpauly/awesome-cursor-skills`](https://github.com/spencerpauly/awesome-cursor-skills) under `.agents/skills/`.

---

## Pillar 1 — Testing & QA

**Baseline:** 2 Jest test files total (1 backend trivial smoke, 1 frontend `authTokenStorage`). `ts-jest` installed but unwired. `supertest` and `@testing-library/react-native` installed but unused. No coverage thresholds, snapshots, integration, or E2E.

**Critical untested logic:**

| Subject | Location |
|---|---|
| `calculatePerformanceGrade` | `backend/src/utils/performanceScoring.ts:277` |
| `haversineMeters` + `/check-in` | `backend/src/routes/group.routes.ts:149-164, 753-859` |
| `buildPerformanceLeaderboard` | `backend/src/routes/group.routes.ts:218-254` |
| `ActiveWorkoutScreen` set logging | `frontend/src/pages/ActiveWorkoutScreen.tsx` |
| `AuthContext` + `api.ts` interceptors | `frontend/src/context/AuthContext.tsx`, `frontend/src/services/api.ts` |

---

## Pillar 2 — Security & Hardening

| # | Finding | File:Lines | Risk |
|---|---|---|---|
| S1 | JWT secrets fall back to `'your-secret-key'` / `'your-refresh-secret'` | `backend/src/middleware/auth.ts:49`, `backend/src/models/User.ts:576-587`, `backend/src/routes/auth.routes.ts:207` | **Critical** — token forgery if env unset |
| S2 | Socket.io rooms joined without auth | `backend/src/server.ts:96-135` | **High** — impersonation, message injection |
| S3 | Tokens fall back to AsyncStorage on web | `frontend/src/storage/authTokenStorage.ts:65-66, 76` | **High** on web — XSS exposure |
| S4 | No Stripe webhook signature verification; dev tier bypass gated only by `NODE_ENV` | `backend/src/routes/billing.routes.ts:70-97` | **High** — bypass if env mis-set |
| S5 | Critical logic has zero tests | see Pillar 1 | **Critical** — no regression safety net |
| S6 | No backend `.env.example` + no env validation | `backend/src/server.ts:29` | **Medium** — silent misconfiguration |
| S7 | `requireGroupAdmin`/`requireGroupMember` defined but unused; TRAINER can list all client emails | `backend/src/middleware/auth.ts:329-431`, `routes/user.routes.ts:77-96` | **Medium-High** — drift + PII over-exposure |
| S8 | No input validation on most `req.body`; no `mongo-sanitize` / `hpp` | many routes; `server.ts:45-62` | **Medium** — NoSQL injection / pollution |
| S9 | 30-day access JWT; frontend clears tokens on 401 instead of refresh | `backend/src/models/User.ts:578`; `frontend/src/services/api.ts:53-59` | **Medium** — long-lived stolen tokens |
| S10 | Global error handler leaks `err.message` in prod | `backend/src/server.ts:170-173` | **Low-Medium** |

---

## Pillar 3 — Performance & Architecture

| # | Finding | File:Lines | Smell |
|---|---|---|---|
| S11 | Active Workout Player re-renders entire tree at 1 Hz; zero `React.memo`; inline arrow fns per row | `frontend/src/pages/ActiveWorkoutScreen.tsx:130-137, 305-336` | Re-render scope |
| S12 | No mid-session persistence in workout player | same file | Data loss on crash |
| S13 | Leaderboard fallback grade formula differs from combine algorithm and stat counters never increment | `backend/src/routes/group.routes.ts:175-186` | Dual semantics |
| S14 | N+1 loops in plan recommendation (up to 120× sequential `findById`) | `backend/src/services/planRecommendation.service.ts:98-115, 124-139, 313-336` | N+1 |
| S15 | `GET /api/groups/:id` returns full embedded document (all posts, memberships, announcements) | `backend/src/routes/group.routes.ts:1116-1183` | Document bloat |
| S16 | Missing `.lean()` on read paths; one explicit `.lean(false)` | `group.routes.ts:305, 1197`; `auth.routes.ts` | Mongoose overhead |
| S17 | No Mongoose pool tuning; localhost DB fallback | `backend/src/server.ts:188` | Connection config |
| S18 | No Sentry / structured logging | `backend/src/server.ts:51, 165-174` | Observability |
| S21 | No design tokens; 30+ inline `#hex` literals in `ActiveWorkoutScreen.tsx` alone | `frontend/src/**` | Token drift |
| S22 | Unused deps: `expo-camera`, `react-native-vector-icons` | `frontend/package.json` | Bundle bloat |

---

## Pillar 4 — CI/CD & DevOps Readiness

| Area | Verdict | Gap |
|---|---|---|
| GitHub Actions | **PARTIAL** | Lint + smoke only; no `tsc`, no build, no integration |
| Pre-commit hooks | **MISSING** | No husky / lint-staged |
| Docker | **MISSING** | No Dockerfile / compose |
| EAS build | **PARTIAL** | Profiles exist; no channels, no `runtimeVersion`, no submit IDs, `projectId` falls back to `"your-project-id"` |
| EAS Update / OTA | **MISSING** | `expo-updates` not installed |
| Backend health | **PARTIAL** | `/health` exists but doesn't check Mongo |
| Graceful shutdown | **PARTIAL** | SIGTERM closes HTTP only; no Mongo close, no SIGINT |
| Logging | **MISSING** | `morgan('dev')` + `console.log` |
| Process manager | **MISSING** | No PM2 / Procfile / PaaS manifest |
| `backend/.env.example` | **MISSING** | README references it but file absent |

---

## Execution Plan (approved)

**Scope:** P0 + P1 (S1–S12)
**Branching:** one branch + PR per pillar
**Web target:** Not shipping web; SecureStore made mandatory, AsyncStorage fallback removed.
**JWT TTL:** Dropping access tokens 30d → 15m; silent refresh shipped in the same release; users in app at deploy will get one forced re-login.

| PR | Branch | Items |
|---|---|---|
| #1 Security | `hardening/security-foundation` | S1, S2, S3, S4, S6, S7, S8, S9 |
| #2 Testing | `testing/critical-logic-coverage` | S5 (perf grade, Haversine, leaderboard, ActiveWorkout) |
| #3 Performance | `perf/active-workout-player` | S11, S12 |
| #4 DevOps | `devops/ci-hardening` | S6 (env.example), S10 (CI tsc/build/mongo service) |

Each PR is reviewed via `parallel-code-review` (security / performance / correctness / readability) before being marked ready.

---

## Deferred (post-launch)

S13 (leaderboard grade semantics), S14 (planRecommendation N+1), S15 (group detail pagination), S16 (.lean() audit), S17 (Mongoose pool), S18 (Sentry + pino), S19 (Dockerfile), S20 (EAS finalization), S21 (theme tokens), S22 (unused deps), S23 (README port drift), S24 (stub routes), S25 (husky + CHANGELOG).
