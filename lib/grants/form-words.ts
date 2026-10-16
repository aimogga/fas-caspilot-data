/** Plain words for the Foundation grants page (DS-22, D-040): the header, one helper sentence per form field, the import help, the hover words
 * for each recent opportunity, and save failures. Pure. Helper sentences name only rules `validateFoundation` and the API enforce. */
import { MANUAL_HINT } from '../dashboard/words';
import type { Term } from '../trust/glossary';
import { MAX_CSV_ROWS } from './foundation-csv';
import { awardRange } from './terms';

export const HEADER = {
  eyebrow: 'Foundation grants',
  title: 'Add the grants foundations publish',
  description: 'Grants.gov opportunities arrive on their own; foundation grants do not. Add each one by hand or import a list, and it starts in the grant pipeline as New.',
};
export const RECENT_HEADLINE = 'Recently added foundation grants';

const DATE = 'like 2026-03-31 or 3/31/2026', MONEY = 'in dollars, like 25000 or $25,000.00', LIST = 'separated by semicolons';
/** One or two sentences per `FOUNDATION_FIELDS` key: what to type, the format, and the rule it must keep. */
export const FORM_HELP: Record<string, string> = {
  title: 'The grant’s name as the funder writes it. Required, up to 200 characters.',
  funder: 'The foundation or organization giving the grant. Required; the same funder, title and close date can be saved only once.',
  posted_date: `The day the funder opened applications, ${DATE}. Leave it blank if the listing does not say.`,
  close_date: `The last day to apply, ${DATE}. It must be on or after the posted date; leave it blank for a rolling deadline.`,
  award_floor: `The smallest single award, ${MONEY}. Leave it blank if the listing does not say; blank is never read as $0.`,
  award_ceiling: `The largest single award, ${MONEY}. It must be at least the award floor.`,
  applicant_types: `Who may apply, ${LIST}, like 501(c)(3); Utah nonprofits.`,
  program_themes: `What the grant pays for, ${LIST}, like mental health; family preservation.`,
  eligibility_notes: 'Any other rule the funder sets, in plain words. Up to 2,000 characters.',
  url: 'The funder’s page for this grant. It must start with http:// or https://.',
  description: 'A short summary of the grant in the funder’s words or yours. Up to 4,000 characters.',
};
export const formHelp = (key: string): string | null => FORM_HELP[key] ?? null;

export const IMPORT_INTRO = `One row per grant, up to ${MAX_CSV_ROWS.toLocaleString('en-US')} rows or 2 MB. Use the template so the columns match the form; separate list items with semicolons.`;
export const PREVIEW_FIX = 'Nothing is imported until every row passes. Download the error report, fix those rows and choose the file again.';
export const DROP_HELP = 'Drop a CSV here or choose one from your computer. Every row is checked before anything is saved.';

/** A stored save failure as words: a duplicate keeps the server sentence; anything else says what may have happened and what to do. */
export function saveFailure(status: number, error?: string): string {
  if (status === 409 && error) return `${error}. Check the list below before adding it again.`;
  return 'The save did not finish. Reload the page to see whether it was saved, then try again.';
}
export function importFailure(status: number, body: { error?: string; errors?: unknown[] }): string {
  if (body.errors?.length) return `${body.errors.length} ${body.errors.length === 1 ? 'row was' : 'rows were'} rejected when saving, so nothing was imported. Fix ${body.errors.length === 1 ? 'that row' : 'those rows'} in your file and choose it again.`;
  if (status === 409 && body.error) return `${body.error}, so nothing was imported. Remove that row from your file and choose it again.`;
  return 'The import did not finish. Reload the page to see what was saved, then try again.';
}

const t = (id: string, title: string, plain: string): Term => ({ id, title, plain });
/** The terms one `ExplainLayer` reads off each recent row. */
export const RECENT_TERMS: Record<string, Term> = {
  manual_entry: t('manual_entry', 'Manual entry', MANUAL_HINT),
  award_range: t('award_range', 'Award range', 'The smallest and largest single award the funder says it will make, as written in its listing. When only one end is given, only that end is shown.'),
  close_date: t('close_date', 'Close date', 'The last day the funder accepts applications, as its listing states it.'),
  funder: t('funder', 'Funder', 'The foundation or organization that gives the grant.'),
};
export const HIDDEN = {
  award: 'The listing did not state an amount, so none was entered. It is never shown as $0.',
  close: 'The listing gave no close date. It may take applications at any time; check the funder’s page before planning around it.',
  funder: 'This entry was saved without a funder name.',
};

export type RecentOpportunity = { id: string; title: string; funder: string | null; close_date: string | null; award_floor: number | null; award_ceiling: number | null; source?: string | null; imported?: string | null };
export type Cell = { text: string; attrs: Record<string, string> };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The stored `raw.imported_at` month (`YYYY-MM`) as "Oct 2026"; anything else is left out. */
export const addedMonth = (ym?: string | null): string | undefined => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? ''), i = m ? Number(m[2]) - 1 : -1;
  return m && i >= 0 && i < 12 ? `${MONTHS[i]} ${m[1]}` : undefined;
};
/** Public opportunity dates may show the day (DS-07 trust rules). */
export const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Text plus the `data-*` an `ExplainLayer` reads for the badge, funder, close date and award of one row; a missing value says so in words and names why. */
export function recentCells(o: RecentOpportunity): { badge: Cell; funder: Cell; close: Cell; award: Cell } {
  const csv = o.source === 'foundation_csv', base = { 'data-source': csv ? 'Imported by FAS staff from a list' : 'Typed in by FAS staff', ...(addedMonth(o.imported) ? { 'data-asof': addedMonth(o.imported)! } : {}) };
  const cell = (term: string, text: string, value: string, hidden?: string): Cell => ({ text, attrs: { 'data-term': term, 'data-value': value, ...base, ...(hidden ? { 'data-hidden': hidden } : {}) } });
  const range = awardRange(o.award_floor, o.award_ceiling), award = range.charAt(0).toUpperCase() + range.slice(1);
  return {
    badge: cell('manual_entry', 'Manual entry', csv ? 'Imported from a list' : 'Added by hand'),
    funder: o.funder ? { text: o.funder, attrs: {} } : cell('funder', 'Funder not stated', 'Not stated', HIDDEN.funder),
    close: o.close_date ? cell('close_date', `Closes ${dayLabel(o.close_date)}`, dayLabel(o.close_date)) : cell('close_date', 'No close date', 'Not stated', HIDDEN.close),
    award: range === 'award not stated' ? cell('award_range', 'Award not stated', 'Not stated', HIDDEN.award) : cell('award_range', award, award),
  };
}
export const recentNote = (n: number) =>
  `The ${n === 1 ? 'newest grant' : `${n} newest grants`}, as each funder published ${n === 1 ? 'it' : 'them'} and entered by FAS staff. “No close date” and “Award not stated” mean the listing did not say; neither is read as a passed deadline or $0.`;
