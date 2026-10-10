import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("gallery sizes, axe, and screenshots", async ({ page }) => {
  const ART = "/opt/cursor/artifacts";
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/ui");
  await expect(page.getByRole("heading", { name: "Component gallery" })).toBeVisible();
  const v = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const buttons = [...document.querySelectorAll("[data-slot=button]")];
    const inputs = [...document.querySelectorAll("[data-slot=input]")];
    const label = document.querySelector("[data-slot=label]");
    const ring = (n: HTMLElement) => {
      n.focus();
      const p = document.createElement("i"); p.style.color = "var(--ring)";
      document.body.append(p);
      const expected = getComputedStyle(p).color;
      p.remove();
      const s = getComputedStyle(n);
      return s.outlineColor === expected && s.outlineWidth === "2px" && s.outlineStyle === "solid";
    };
    const btn = buttons[0] as HTMLElement;
    const light = ring(btn);
    document.documentElement.classList.add("dark");
    const dark = ring(btn);
    document.documentElement.classList.remove("dark");
    const err = document.querySelector("#gallery-err");
    return {
      minTap: Math.min(...buttons.flatMap((el) => [box(el).height, box(el).width]), ...inputs.map((el) => box(el).height)),
      inputPx: Math.min(...inputs.map((el) => parseFloat(getComputedStyle(el).fontSize))),
      ok: !!label && getComputedStyle(label).display === "block" && !!inputs[0] && box(label).bottom <= box(inputs[0]).top + 1 && err?.getAttribute("aria-invalid") === "true" && err.getAttribute("aria-describedby") === "gallery-err-msg" && light && dark && ring(document.querySelector("#gallery-email") as HTMLElement),
      scroll: document.documentElement.scrollWidth,
    };
  });
  expect(v.minTap).toBeGreaterThanOrEqual(44);
  expect(v.inputPx).toBeGreaterThanOrEqual(16);
  expect(v.ok).toBe(true);
  expect(v.scroll).toBeLessThanOrEqual(376);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((x) => x.impact === "serious" || x.impact === "critical")).toEqual([]);
  await page.screenshot({ path: `${ART}/gallery-375.png`, fullPage: true });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({ path: `${ART}/gallery-1024.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.evaluate(() => {
    const h = (t: string) => [...document.querySelectorAll("[data-slot=button]")].find((el) => el.textContent === t)!.getBoundingClientRect().height;
    const b = (name: string) => getComputedStyle(document.querySelector(`[data-variant="${name}"]`)!).borderTopWidth;
    return { sm: h("sm"), def: h("default"), ghost: b("ghost"), link: b("link") };
  })).toMatchObject({ sm: 32, def: 40, ghost: "0px", link: "0px" });
  await page.screenshot({ path: `${ART}/gallery-1440.png`, fullPage: true });
  await page.locator("[data-slot=button]").first().focus();
  const box = await page.locator("[data-slot=button]").first().boundingBox();
  if (box) await page.screenshot({ path: `${ART}/gallery-focus-button.png`, clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
  await page.screenshot({ path: `${ART}/gallery-focus.png`, fullPage: true });
});
