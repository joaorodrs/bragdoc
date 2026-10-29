# Repository Guidelines

## Project Structure

This is a Next.js App Router application. `app/` contains the page, root layout, and server Route Handlers; `app/api/ai/analyze/route.ts` performs user-triggered AI analysis. `src/` contains the client UI, Supabase browser client, and direct data operations. `shared/` holds domain types. `supabase/schema.sql` defines database tables and row-level security.

## Development Commands

- `npm install` installs dependencies.
- `npm run dev` starts Next.js at `http://127.0.0.1:3000`.
- `npm run typecheck` checks TypeScript without emitting files.
- `npm run build` builds the production app; `npm start` serves it locally.

## Style and Data Access

Use TypeScript, two-space indentation, single quotes, and semicolons. Name React components in PascalCase, functions and hooks in camelCase, and SQL names in snake_case. Read and write journal and achievement data through `@supabase/supabase-js`. Keep OpenAI calls in server Route Handlers and never expose `OPENAI_API_KEY` or a Supabase `service_role` key through client code or `NEXT_PUBLIC_*` variables.

## Security

Enable RLS for every user-owned table and scope policies to `auth.uid()`. For server-side Supabase queries, validate the user's access token and forward that token so RLS remains active. Send journal text to the model only after the user explicitly selects a period and requests analysis. Keep UI copy natural and consistent in Portuguese.

## Changes

Use concise imperative commit messages. Pull requests should summarize visible changes, list verification commands, link related issues, and include screenshots for UI work.
