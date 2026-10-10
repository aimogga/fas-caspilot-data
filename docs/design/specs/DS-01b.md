# DS-01b — shadcn init + base components
**Depends on:** DS-01a. **Budget:** ≤ 400 hand-written lines. Only *untouched* `shadcn add` output counts as generated (D-012), and it is listed by name. Any file we hand-edit (button, badge, alert, input, label) counts toward the 400 lines in full. QA diffs the untouched files against `shadcn add` output.

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
  - Button: **44px tall by default at every width** (`h-11`). The `sm` and `default` sizes shrink only at desktop width through responsive classes: `sm` = `h-11 lg:h-8` (32px at ≥ 1024px), `default` = `h-11 lg:h-10` (40px at ≥ 1024px), `lg` = `h-11`. Icon buttons are `size-11 lg:size-10`. Below 1024px every button is ≥ 44×44. The loading prop keeps its width.
  - Input: `h-12 md:h-11`, `text-base` (16px) at every width; never `text-sm` on inputs. Full width (`w-full`) by default.
  - Label: block, sits above its field with an 8px gap; there is no inline-label variant.
  - Badge: variants success / warning / destructive / info / muted using the `*-soft` tokens; requires an icon or text prefix.
  - Alert: destructive / warning / info variants; destructive uses `role="alert"`.
- Dev-only gallery route `app/(dev)/ui/page.tsx`, excluded in production (404 unless `NODE_ENV!=='production'`), rendering every variant.

**Acceptance**
1. CI green and `pnpm build` passes.
2. Gallery screenshots at 375, 1024 and 1440. At 375, Playwright asserts every button and input is ≥ 44px tall and input font-size ≥ 16px; axe shows 0 serious or critical issues.
3. Keyboard focus ring is visible on button and input (screenshot).
4. Generated files match `shadcn add` output, except the documented hand-edits.

**Mobile hard requirements (QA-checked at 375):** labels stacked above full-width fields; ≥ 16px side padding on login and pages; input text ≥ 16px; every tappable control ≥ 44×44px; no horizontal scroll. Contrast meets WCAG 2.2 AA (text 4.5:1, large text/UI 3:1).
