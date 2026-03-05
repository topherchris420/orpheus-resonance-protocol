# Reentry Interface

Reentry Interface is a React + TypeScript tactical dashboard prototype for simulation-heavy operations workflows. It combines real-time visual telemetry, interactive mission modules, and operator-state monitoring into a single browser-based command surface.

## Why this project exists

This repository is a front-end sandbox for exploring:

- high-density control-room UIs
- simulation-oriented interaction patterns
- resilient UX behavior under noisy runtime conditions
- configurable feature toggles for gated demos and staged rollouts

## Commercial-readiness capabilities included

- **Global runtime safety net** via an application error boundary with incident IDs and support contact fallback.
- **Environment-driven runtime configuration** (`.env`) for feature flags and operational thresholds.
- **Explicit microphone-consent flow** so audio biofeedback remains opt-in.
- **Access-gate hardening controls** with configurable attempt limits and temporary lockouts.
- **Node-first test tooling** through Vitest (no Bun dependency required).
- **CI-friendly scripts** for linting, build, preview, and test workflows.

## Technology stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI primitives
- TanStack Query
- Vitest + V8 coverage

## Project structure (high level)

```text
src/
  components/      Reusable UI and domain modules (simulation widgets, status panels)
  config/          App-level runtime configuration parsing
  data/            Static/mock realistic data sets + tests
  hooks/           Custom interaction and state hooks
  pages/           Route-level views
  lib/             Shared utilities
```

## Prerequisites

- **Node.js 18+** (Node 20+ recommended)
- **npm** (ships with Node)

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local environment file:
   ```bash
   cp .env.example .env
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the local URL printed by Vite (usually `http://localhost:5173`).

## Environment variables

Use `.env.example` as the baseline.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_APP_NAME` | `Reentry Interface` | Display name shown in the UI. |
| `VITE_SUPPORT_EMAIL` | `support@example.com` | Contact shown in fatal-error fallback states. |
| `VITE_REQUIRE_ACCESS_GATE` | `true` | Enables/disables the access terminal gate. |
| `VITE_ENABLE_AUDIO_BIOFEEDBACK` | `true` | Enables microphone-based analysis features. |
| `VITE_MAX_INTEL_FEED_ITEMS` | `10` | Max intel-feed history retained in UI memory. |
| `VITE_MAX_ACCESS_ATTEMPTS` | `5` | Allowed gate attempts before lockout. |
| `VITE_ACCESS_LOCKOUT_MS` | `30000` | Lockout duration in milliseconds. |
| `VITE_ACCESS_PASSPHRASE` | `1912` | Demo passphrase used by the client-side gate flow. |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development server. |
| `npm run build` | Create production bundle. |
| `npm run build:dev` | Build using development mode flags. |
| `npm run preview` | Preview production build locally. |
| `npm run lint` | Run ESLint across the project. |
| `npm run test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Run tests with coverage output. |

## Recommended local validation sequence

Run these before opening a PR:

```bash
npm run lint
npm run test
npm run build
```

## Production and security notes

- The access terminal is a **client-side interaction gate**, not authentication.
- For production deployment, enforce identity, authorization, and audit logging at an API/server layer.
- Avoid processing sensitive biometric or regulated data exclusively in the frontend; use compliant backend controls and explicit consent workflows.

## Troubleshooting

- **Port already in use**: run `npm run dev -- --port 5174` to use an alternate port.
- **Environment changes not reflected**: stop/restart the Vite dev server after editing `.env`.
- **Microphone access unavailable**: ensure browser permissions are granted and `VITE_ENABLE_AUDIO_BIOFEEDBACK=true`.

## License

MIT (see [`LICENSE`](LICENSE)).
