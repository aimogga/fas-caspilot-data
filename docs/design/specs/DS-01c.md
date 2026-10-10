# DS-01c — Layout primitives
**Depends on:** DS-01b. **Budget:** ≤ 400 lines. **No new dependencies.**

**Scope** (`components/layout/`):
- `Page` (max-w 1280, gutters 24/16);
- `PageHeader` (eyebrow, serif H1, description, actions slot);
- `Stack` / `Cluster` (gap from the scale only);
- `Grid` (cols 1/2/3/4, collapses at md);
- `Section`;
- `EmptyState` (icon slot, title, one sentence, one action);
- `ErrorState` (message, retry, reference id);
- `Skeleton` blocks.

Trust primitives (`components/trust/`):
- `SourceFooter` (source · period · n · as of);
- `SuppressedCell` (hatched, "— n<11", tooltip text, sr-only explanation);
- `FreshnessChip` (current / stale / failed, glyph + word);
- `NotPublished`;
- `DraftBanner`.

Add all of these to the dev gallery.

**Acceptance**
1. Unit tests:
   - `SuppressedCell` never renders a number;
   - `FreshnessChip` always renders text;
   - `SourceFooter` requires an as-of date (TypeScript type).
2. Gallery screenshots at 1440 and 1024; axe clean.
3. No inline styles; tokens only.

## Mobile layout (375px; applies below 768px)
Breakpoints: `mobile` < 768, `tablet` 768–1279, `desktop` ≥ 1280. Test widths 375 / 1024 / 1440.
- `PageContainer`: padding 16px left/right, 20px top, 40px bottom (tablet 24px, desktop 32px). Max width none on mobile.
- `PageHeader`: stacks vertically, gap 12px. Title H1 Source Serif 4 28px/1.15 (desktop 32px). Actions go below the title, full width, 44px high, primary first.
- `Grid` (`cols` 2/3/4): collapses to 1 column, gap 12px; tablet keeps 2 columns.
- `Stack`/`Cluster`: Cluster wraps; never lets children force width beyond the viewport (`min-width:0` on flex children).
- `Card`: padding 16px (desktop 20–24px); radius unchanged.
- `ResponsiveTable` helper: below 768px a table marked `stack` renders each row as a 2-column grid (first cell spans full width as the label row; action cell right-aligned, 44px target). Data tables that must stay tabular scroll inside their own card (`overflow-x:auto`) with a visible "Scroll →" hint; the page itself never scrolls horizontally.
- Base type on mobile: body 15px, inputs 16px, smallest text 12px.
- Acceptance additions: Playwright asserts `scrollWidth <= 375` on the primitives demo page; screenshots at 375/1024/1440.
- Line budget unchanged (target ≤ 300); mobile rules are ~40 lines of CSS.
