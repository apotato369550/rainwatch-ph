# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains Next.js App Router pages, global styles, and server API routes.
- `components/` contains dashboard UI; `lib/` holds shared types, weather validation, rainfall calculations, provider fetching, and optional Supabase/ML integration.
- `public/` contains the bundled Philippines GeoJSON outline. Shared visual tokens live in `lib/design.ts`.
- `tests/*.test.ts` contains unit checks; `tests/browser/` contains Playwright scenarios and fixtures.
- `supabase/` contains migrations and ingestion functions; `ml/` contains offline Python training, evaluation, and model-promotion scripts.

## Build, Test, and Development Commands
Use Node.js 20.9+; Node 24 is recommended.
- `npm install` installs dependencies; `npm run dev` starts development at `localhost:3000`.
- `npm run build` creates the production build; `npm start` serves it.
- `npm run lint` runs ESLint; `npm run typecheck` checks strict TypeScript types.
- `npm test` runs unit tests through `tsx` and Node’s test runner.
- `npx playwright install chromium`, then `npm run build && npm run test:e2e`, runs browser checks against a production server on port 3100.
- `npm run ml:evaluate` evaluates the offline model; see `ml/README.md` for prerequisites.

## Coding Style & Naming Conventions
Follow existing TypeScript style: two-space indentation, double quotes, semicolons, and explicit shared contracts. Use PascalCase for React components/types, camelCase for functions/variables, and kebab-case filenames such as `rainfall-summary.tsx`. Keep calculations in `lib/` separate from presentation. ESLint uses Next.js Core Web Vitals and TypeScript rules; no separate formatter is configured.

## Testing Guidelines
Name unit tests `*.test.ts` and browser tests `*.spec.ts`. Cover changed calculations, validation, missing inputs, and error handling. Use deterministic browser fixtures for UI, responsi
plans/ve, and axe accessibility checks; live weather scenarios require Open-Meteo availability. No numeric coverage threshold is configured. Run lint, typecheck, unit tests, and build before submitting.

## Commit & Pull Request Guidelines
Recent history commonly uses `feat: ...`, alongside descriptive unprefixed subjects. Write concise, action-oriented subjects and keep changes focused. PRs should describe behavior changes, list verification commands/results, link relevant issues, and include screenshots for UI changes.

## Security & Configuration
The live dashboard works without credentials. For optional persistence, follow `.env.example`; never commit secrets or expose the Supabase service-role key to browser code. `npm run db:seed` resets the local database, not production. Preserve raw-forecast fallback behavior and the distinction between experimental rainfall stress and flood prediction.
