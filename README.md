# Reentry Interface

Reentry Interface is a React + TypeScript control-room style dashboard prototype for simulation-heavy operations workflows.

## Commercial-Readiness Enhancements Included

- Global runtime error boundary with incident IDs and support contact fallback.
- Environment-driven configuration (`.env`) for feature flags and operational limits.
- Explicit microphone consent flow (biofeedback is opt-in and can be toggled on/off).
- Access-gate hardening with configurable attempt limits and temporary lockouts.
- Standardized Node-based tests via Vitest (no Bun dependency required).
- Lint/build/test scripts aligned for CI usage.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file:
   ```bash
   copy .env.example .env
   ```
3. Run locally:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for defaults.

- `VITE_APP_NAME`: Display name used in UI.
- `VITE_SUPPORT_EMAIL`: Contact shown in fatal-error fallback.
- `VITE_REQUIRE_ACCESS_GATE`: Enables/disables the access terminal gate.
- `VITE_ENABLE_AUDIO_BIOFEEDBACK`: Enables microphone-based analysis features.
- `VITE_MAX_INTEL_FEED_ITEMS`: Max live intel feed history size.
- `VITE_MAX_ACCESS_ATTEMPTS`: Attempts before temporary lockout.
- `VITE_ACCESS_LOCKOUT_MS`: Lockout duration in milliseconds.
- `VITE_ACCESS_PASSPHRASE`: Client-side gate phrase for demo flow.

## Scripts

- `npm run dev`: Start local dev server.
- `npm run build`: Create production build.
- `npm run preview`: Preview production bundle.
- `npm run lint`: Run ESLint.
- `npm run test`: Run test suite once (Vitest).
- `npm run test:watch`: Run tests in watch mode.
- `npm run test:coverage`: Run tests with coverage.

## Production Notes

- The access terminal is a client-side interaction gate, not authentication.
- For commercial deployment, enforce identity, authorization, and audit logging on a server/API tier.
- Keep PII and regulated biometric processing out of the frontend unless backed by compliant backend controls.

## License

MIT (see `LICENSE`).
