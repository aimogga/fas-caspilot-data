import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExplainBody, ExplainCard, Hint, Provenance } from "@/components/trust/explain";
import { FreshnessChip, NotPublished, SourceFooter, SuppressedCell } from "@/components/trust";
import { GLOSSARY, HIDDEN_SMALL } from "@/lib/trust/glossary";

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const TRIGGER = /<button type="button" aria-haspopup="dialog"[^>]*data-slot="(hint|explain)-trigger"/;

describe("DS-09 explain kit", () => {
  it("Hint and ExplainCard render one trigger button that announces a dialog; the icon variant is labelled About <title>", () => {
    const hint = renderToStaticMarkup(<Hint text="One line">chip</Hint>), card = renderToStaticMarkup(<ExplainCard term="m1">23 days</ExplainCard>);
    const icon = renderToStaticMarkup(<ExplainCard icon term="m1" />);
    for (const m of [hint, card, icon]) expect(m).toMatch(TRIGGER);
    expect([(card.match(/<button/g) ?? []).length, card.includes("decoration-dotted"), text(hint)]).toEqual([1, true, "chip"]);
    expect(icon).toMatch(/aria-label="About Days from court order to first session"[^>]*>\s*<svg/);
  });
  it("ExplainBody prints the title, the plain words and only the rows it was given", () => {
    expect(text(renderToStaticMarkup(<ExplainBody term={GLOSSARY.m1} />))).toBe(`${GLOSSARY.m1.title} ${GLOSSARY.m1.plain}`);
    const full = renderToStaticMarkup(<ExplainBody term={GLOSSARY.m1} titleId="t1" value="23 days" source="FAS records" asOf="Sep 2026" hidden={HIDDEN_SMALL} rows={[["Period", "Q3"], ["Vintage", undefined]]} />);
    expect(full).toContain('<p id="t1" class="font-medium">');
    expect(text(full)).toMatch(/Value 23 days Source FAS records As of Sep 2026 Period Q3 Why it's hidden Fewer than 11 families/);
    expect(text(full)).not.toContain("Vintage");
    expect(text(renderToStaticMarkup(<ExplainBody term={GLOSSARY.m1} asOf="Not available yet" />))).toContain("As of date not available yet");
  });
  it("SuppressedCell never prints the count and no longer uses a native title", () => {
    for (const count of [3, 7, 10]) {
      const markup = renderToStaticMarkup(<SuppressedCell count={count} />);
      expect([markup.includes(String(count)), markup.includes("title="), TRIGGER.test(markup)]).toEqual([false, false, true]);
      expect(text(markup)).toBe("— n<11 Suppressed because the count is under 11, to protect privacy.");
    }
  });
  it("SourceFooter keeps its visible text and makes it the Provenance trigger; chips and Not published get a Hint", () => {
    const footer = renderToStaticMarkup(<SourceFooter source="FAS records" period="Q3" n="= 12" asOf="Sep 2026" detail={{ sourceId: "fas_upload" }} />);
    expect(text(footer)).toBe("FAS records · Q3 · n = 12 · as of Sep 2026");
    expect(footer).toMatch(/<p data-slot="source-footer"[^>]*><button type="button" aria-haspopup="dialog"[^>]*decoration-dotted/);
    expect(text(renderToStaticMarkup(<Provenance source="Census SAHIE" period="2023" n={29} asOf="Oct 2026">x</Provenance>))).toBe("x");
    expect(renderToStaticMarkup(<FreshnessChip status="stale" />)).toMatch(/data-slot="freshness"><button[^>]*data-slot="hint-trigger"[^>]*rounded-full.*Stale/);
    expect(renderToStaticMarkup(<NotPublished reason="Fewer than 11 families" />)).toMatch(/data-slot="not-published"[^>]*><button[^>]*data-slot="hint-trigger".*Not published — Fewer than 11 families/);
  });
});
