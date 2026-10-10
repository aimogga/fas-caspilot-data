# DS-01b — shadcn init + base components
**Depends on:** DS-01a. **Budget:** ≤ 400 hand-written lines. shadcn-generated component files count as generated (D-012); list them by name, and QA diffs them against `shadcn add` output.

**Pins:**
- `shadcn@4.21.4` (CLI, run via `pnpm dlx shadcn@4.21.4`)
- `class-variance-authority@0.7.1`
- `clsx@2.1.1`
- `tailwind-merge@3.7.0`
- `radix-ui@1.7.0`
- `lucide-react@1.55.0` (status glyphs only; no decorative icons)

**Scope**
- `components.json`: style new-york, css `app/globals.css`, baseColor neutral; don't let the CLI overwrite the DS-01a tokens.
- `lib/utils.ts` with `cn()`.
- `shadcn add button input label card badge alert separator`.
- Hand-edits:
  - Button: sizes sm 32 / default 40 / lg 44; loading prop keeps its width.
  - Badge: variants success / warning / destructive / info / muted using the `*-soft` tokens; requires an icon or text prefix.
  - Alert: destructive / warning / info variants; destructive uses `role="alert"`.
- Dev-only gallery route `app/(dev)/ui/page.tsx`, excluded in production (404 unless `NODE_ENV!=='production'`), rendering every variant.

**Acceptance**
1. CI green and `pnpm build` passes.
2. Gallery screenshot at 1440; axe shows 0 serious or critical issues.
3. Keyboard focus ring is visible on button and input (screenshot).
4. Generated files match `shadcn add` output, except the documented hand-edits.
