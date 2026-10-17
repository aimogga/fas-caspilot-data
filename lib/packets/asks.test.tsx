import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GrantAsks } from "@/components/packets/GrantAsks";
import { askedEvidence } from "@/lib/grants/score";
import { grantAsks, loadGrantAsks } from "@/lib/packets/asks";

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const NOW = new Date("2026-10-14T12:00:00Z");

describe("F-403c: what this grant asks for", () => {
  it("reads the listing with the fit score's own rule and maps each kind to the packet section that carries it", () => {
    expect(askedEvidence("Report client outcomes, cost per family and wait times.")).toEqual(["outcomes", "cost", "timeliness"]);
    expect(grantAsks("Report client outcomes and cost per family.", ["outcomes"])).toEqual([
      { kind: "outcomes", label: "Client outcomes", section: "Outcomes", figure: "Outcome change", loaded: true },
      { kind: "cost", label: "Cost evidence", section: "FAS results", figure: "Cost per completed episode", loaded: false },
    ]);
    expect(grantAsks("General operating support.", ["outcomes"])).toEqual([]);
  });
  it("loads the listing by id and the org's loaded evidence; an unreadable listing gives no note", async () => {
    const calls: string[] = [];
    const client = (opp: unknown, error: { message: string } | null = null) => ({ from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not", "gte"]) q[m] = (...a: unknown[]) => { calls.push(`${t}.${m}:${a.join(",")}`); return q; };
      q.maybeSingle = async () => ({ data: opp, error });
      q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ count: t === "outcome_measure" ? 12 : 3, error: null }).then(ok);
      return q;
    } }) as never;
    const asks = await loadGrantAsks(client({ description: "Applicants report outcomes and cost.", eligibility: null, raw: null }), "opp-1", "org-1", NOW);
    expect(asks?.map((a) => [a.kind, a.loaded])).toEqual([["outcomes", true], ["cost", false]]);
    expect(calls).toEqual(expect.arrayContaining(["opportunity.eq:id,opp-1", "outcome_measure.eq:org_id,org-1"]));
    expect([await loadGrantAsks(client(null), "x", "org-1", NOW), await loadGrantAsks(client(null, { message: "boom" }), "x", "org-1", NOW)]).toEqual([null, null]);
  });
  it("the note says it is staff-only, links Enter data for kinds not loaded, and says so when the listing asks for none", () => {
    const html = renderToStaticMarkup(<GrantAsks asks={grantAsks("Report outcomes and cost.", ["outcomes"])} />);
    expect(text(html)).toContain("For FAS staff only, read from the grant listing. It is not part of the packet or its downloads.");
    expect(text(html)).toContain("Client outcomes · in Outcomes (Outcome change) · FAS has at least 11 records from the last 12 months");
    expect(text(html)).toContain("Cost evidence · in FAS results (Cost per completed episode) · Not enough FAS records yet. Add them on Enter data");
    expect((html.match(/href="\/staff\/entry"/g) ?? []).length).toBe(1);
    expect(text(renderToStaticMarkup(<GrantAsks asks={[]} />))).toContain("The listing names no outcome, cost or wait-time evidence.");
  });
});
