import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExplainLayer } from '@/components/trust/explain-layer';
import { GLOSSARY } from '@/lib/trust/glossary';
import { CARD_WIDTH, cardPosition, liveText, nextTarget } from '@/lib/trust/layer';

const layer = { left: 100, top: 50, width: 800, height: 600 };
describe('DS-11a explain layer', () => {
  it('places the card under the target, inside the layer, and above it when it would run off the bottom', () => {
    expect(cardPosition({ left: 150, top: 100, width: 60, height: 20 }, layer)).toEqual({ left: 50, top: 74 });
    expect(cardPosition({ left: 850, top: 100, width: 60, height: 20 }, layer).left).toBe(layer.width - CARD_WIDTH);
    expect(cardPosition({ left: 40, top: 600, width: 60, height: 20 }, layer, 200)).toEqual({ left: 0, top: 346 });
  });
  it('reads only the parts that are present, with the as-of in words', () => {
    expect(liveText(GLOSSARY.rank, { value: '4 of 26', source: 'Need score version v2' })).toBe('Rank · 4 of 26 · Need score version v2');
    expect(liveText(GLOSSARY.not_published, { asof: 'Not available yet', hidden: 'Why' })).toBe('Not published · date not available yet · Why');
  });
  it('arrow keys walk the targets from either end; other keys do nothing', () => {
    expect(['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Tab'].map((k) => nextTarget(-1, k, 5))).toEqual([0, 4, 0, 4, -1]);
    expect([nextTarget(4, 'ArrowRight', 5), nextTarget(0, 'ArrowLeft', 5), nextTarget(2, 'ArrowDown', 5), nextTarget(0, 'End', 0)]).toEqual([4, 0, 3, -1]);
  });
  it('renders its children, no card and an empty polite live region on the server', () => {
    const out = renderToStaticMarkup(<ExplainLayer><td data-term="rank" data-value="1 of 26">1 of 26</td></ExplainLayer>);
    expect(out).toMatch(/^<div data-slot="explain-layer" class="relative "><td data-term="rank" data-value="1 of 26">1 of 26<\/td><span aria-live="polite" class="sr-only"><\/span><\/div>$/);
  });
});
