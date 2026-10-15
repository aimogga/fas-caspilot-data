/** F-404 DOCX export (pure): the packet model rendered with `docx`. Every string comes from `Packet` through `docxBlocks` (picture captions via
 * `pictureCaption`, which `renderText` lists too), never recomputed, so `assertPacket` on the model and the checks over `docxText` cover the same text.
 * Letter, 1-inch margins, built-in fonts only; pictures are SVG with a PNG fallback. */
import { AlignmentType, Document, Footer, HeadingLevel, ImageRun, type IRunOptions, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { Picture } from '../board/pictures';
import { pictureFallback } from '../charts/png';
import { pictureCaption, pictureSvg, SVG_WIDTH, svgHeight } from '../charts/svg';
import { PICTURE_SECTION, type Packet } from './model';

export type DocxBlock = { kind: 'title' | 'subtitle' | 'ribbon' | 'heading' | 'paragraph' | 'row' | 'picture' | 'source' | 'footer'; text: string[]; picture?: Picture };
/** Pictures print 6 in wide (Letter, 1 in margins leave 6.5 in); pixels at 96 to the inch. */
const PICTURE_PX = 576;
const TWIP_INCH = 1440, LETTER = { width: 8.5 * TWIP_INCH, height: 11 * TWIP_INCH }, MARGIN = TWIP_INCH, FONT = 'Arial';
export const FIGURE_HEADER = ['Figure', 'Value', 'Source · as of'];

/** The document in reading order: cover, then each section (heading, paragraphs, one row per figure, its pictures with a caption, source line), then the running footer. */
export function docxBlocks(p: Packet): DocxBlock[] {
  const out: DocxBlock[] = [{ kind: 'ribbon', text: [p.ribbon] }, { kind: 'title', text: [p.title] }, { kind: 'subtitle', text: [`${p.prepared} · ${p.asOf}`] }];
  for (const s of p.sections) {
    out.push({ kind: 'heading', text: [s.title] }, ...s.paragraphs.map((t) => ({ kind: 'paragraph' as const, text: [t] })));
    out.push(...s.figures.map((f) => ({ kind: 'row' as const, text: [f.label, f.value, `${f.sourceLabel} · as of ${f.asOf}`] })));
    out.push(...p.pictures.filter((pic) => PICTURE_SECTION[pic.id] === s.id).map((pic) => ({ kind: 'picture' as const, text: [pictureCaption(pic)], picture: pic })));
    out.push({ kind: 'source', text: [s.source] });
  }
  return [...out, { kind: 'footer', text: [p.footer] }];
}
/** Exactly the strings placed in the document, flattened; the unit test runs the privacy checks over this list. */
export const docxText = (p: Packet): string[] => docxBlocks(p).flatMap((b) => b.text);

const run = (text: string, extra: Omit<IRunOptions, 'text'> = {}) => new TextRun({ text, font: FONT, ...extra });
const cell = (text: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [run(text, { bold, size: 20 })] })] });
const table = (rows: DocxBlock[]) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [new TableRow({ tableHeader: true, children: FIGURE_HEADER.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: r.text.map((t, i) => cell(t, i === 0)) }))],
});
/** Blocks → docx children. Figure rows are grouped into one three-column table per section (label · value · source and as-of). */
function children(blocks: DocxBlock[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  let rows: DocxBlock[] = [];
  const flush = () => { if (rows.length) out.push(table(rows)); rows = []; };
  for (const b of blocks) {
    if (b.kind === 'row') { rows.push(b); continue; }
    flush();
    const text = b.text[0] ?? '';
    if (b.kind === 'ribbon') out.push(new Paragraph({ spacing: { before: 2400, after: 240 }, children: [run(text, { bold: true, color: '9A6700', size: 20 })] }));
    else if (b.kind === 'title') out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [run(text)] }));
    else if (b.kind === 'subtitle') out.push(new Paragraph({ spacing: { after: 240 }, children: [run(text, { size: 22, color: '555555' })] }));
    else if (b.kind === 'heading') out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [run(text)] }));
    else if (b.kind === 'paragraph') out.push(new Paragraph({ spacing: { after: 160 }, children: [run(text, { size: 22 })] }));
    else if (b.kind === 'picture' && b.picture) out.push(...picture(b.picture, text));
    else if (b.kind === 'source') out.push(new Paragraph({ spacing: { before: 160 }, children: [run(text, { size: 18, color: '555555' })] }));
  }
  flush();
  return out;
}
/** The SVG picture with a raster fallback for viewers without SVG, then its caption; the alt text is the caption too. */
function picture(p: Picture, caption: string): Paragraph[] {
  const width = PICTURE_PX, height = Math.round((svgHeight(p) * PICTURE_PX) / SVG_WIDTH);
  const image = new ImageRun({ type: 'svg', data: Buffer.from(pictureSvg(p), 'utf8'), fallback: { type: 'png', data: pictureFallback(p, width, height) }, transformation: { width, height }, altText: { title: p.eyebrow, description: caption, name: p.id } });
  return [new Paragraph({ spacing: { before: 200 }, children: [image] }), new Paragraph({ spacing: { after: 160 }, children: [run(caption, { size: 18, color: '555555' })] })];
}
/** Letter page, 1-inch margins, a footer on every page, one `Document` section with a page break before each packet section. */
export async function packetToDocx(p: Packet): Promise<Uint8Array<ArrayBuffer>> {
  const blocks = docxBlocks(p), footer = blocks.find((b) => b.kind === 'footer')?.text[0] ?? p.footer;
  const doc = new Document({
    creator: 'FAS Evidence', title: p.title, description: p.ribbon,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { size: LETTER, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(footer, { size: 18, color: '555555' })] })] }) },
      children: children(blocks.filter((b) => b.kind !== 'footer')),
    }],
  });
  return Uint8Array.from(await Packer.toBuffer(doc));
}
