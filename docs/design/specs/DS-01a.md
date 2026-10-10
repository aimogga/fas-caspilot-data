# DS-01a — Tailwind v4 + design tokens
**Depends on:** PR #28 (rename) merged. **Budget:** ≤ 400 hand-written lines.

**Pins** (npm latest as of 2026-10-10; all peer-compatible with React 19). Confirm with `pnpm build` on Next 16.4.0 / React 19.3.0 and pin exact versions with no `^`:
- `tailwindcss@4.3.3`
- `@tailwindcss/postcss@4.3.3`
- `tw-animate-css@1.4.0`

**Scope**
- `postcss.config.mjs` with `@tailwindcss/postcss`.
- Replace `app/globals.css` with: `@import "tailwindcss"`, `@import "tw-animate-css"`, the full `:root` + `.dark` oklch tokens, `@theme inline` and the shadow/motion tokens from design-system §4–5, plus a base layer (`button,input,select,textarea{font:inherit}`, `:focus-visible` ring, reduced motion). Add tokens `--tap-min: 44px`, `--input-font: 16px` and `--page-gutter-mobile: 16px`, and the Tailwind breakpoints `md: 768px` (tablet) and `lg: 1024px` (desktop). Layout uses no other breakpoints.
- `app/layout.tsx`:
  - `next/font/google`: Inter (variable, `--font-inter`), Source Serif 4 (`--font-source-serif`), JetBrains Mono (`--font-jetbrains`);
  - `lang="en"`;
  - metadata title template `%s · FAS Evidence`.
- Remove the old raw-hex tokens. Keep `page.module.css` working or delete it if DS-04 replaces `/`. Note which one in the PR.

**Acceptance**
1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; e2e `auth-roles.spec.ts` green.
2. Computed `--primary` on `<html>` equals `oklch(0.38 0.06 160)`; body font is Inter; h1 is Source Serif 4. Verify with a Playwright evaluate.
3. No raw hex remaining in `app/**/*.css`.
4. Screenshot of `/login` at 1440 attached. It's still unstyled form-wise, but now in Inter.

**Out of scope:** components, shell, page redesigns.

**Mobile hard requirements (QA-checked at 375):** labels stacked above full-width fields; ≥ 16px side padding on login and pages; input text ≥ 16px; every tappable control ≥ 44×44px; no horizontal scroll. Contrast meets WCAG 2.2 AA (text 4.5:1, large text/UI 3:1).
