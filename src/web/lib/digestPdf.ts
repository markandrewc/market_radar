import type { Digest } from '../../shared/types';

const date = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Builds the briefing as a PDF in the browser. jsPDF is loaded only when someone asks for it. */
export async function buildDigestPdf(digest: Digest) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 18, width = W - 2 * M;
  let y = M;

  const room = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const write = (text: string, o: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number; link?: string } = {}) => {
    const { size = 10, bold = false, color = [30, 41, 59], indent = 0, gap = 1.5, link } = o;
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(text, width - indent) as string[];
    const lh = size * 0.42;
    for (const line of lines) {
      room(lh + 1);
      if (link) doc.textWithLink(line, M + indent, y + lh, { url: link }); else doc.text(line, M + indent, y + lh);
      y += lh + 0.6;
    }
    y += gap;
  };

  write('Powercoders · Market Radar', { size: 9, color: [168, 50, 78], bold: true, gap: 1 });
  write(digest.subject, { size: 16, bold: true, color: [26, 35, 76], gap: 1 });
  write(`Generated ${date(digest.generatedAt)}`, { size: 9, color: [71, 85, 105], gap: 5 });

  if (digest.empty || digest.sections.length === 0) {
    write(digest.text || 'There is nothing to report for the selected topics yet.');
  }
  for (const s of digest.sections) {
    room(14);
    write(s.heading, { size: 12, bold: true, color: [26, 35, 76], gap: 2 });
    for (const b of s.bullets) {
      write(`• ${b.text}`, { indent: 2, gap: 0.5 });
      write(`${b.source.name}${b.source.dataAsOf ? ` · data as of ${date(b.source.dataAsOf)}` : ''} · retrieved ${date(b.source.fetchedAt)}`, { size: 8, color: [71, 85, 105], indent: 6, gap: 0 });
      write(b.source.url, { size: 8, color: [168, 50, 78], indent: 6, gap: 3, link: b.source.url });
    }
    if (s.note) write(`Our reading, not the source: ${s.note}`, { size: 9, color: [71, 85, 105], indent: 2, gap: 4 });
  }

  const sources = [...new Map(digest.sources.map((x) => [x.id || x.url, x])).values()];
  if (sources.length) {
    room(16);
    write('Sources in this briefing', { size: 11, bold: true, color: [26, 35, 76], gap: 2 });
    for (const x of sources) write(`${x.name} · retrieved ${date(x.fetchedAt)} · ${x.url}`, { size: 8, color: [71, 85, 105], gap: 1, link: x.url });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i).setFont('helvetica', 'normal').setFontSize(8).setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 8, { align: 'right' });
  }
  return doc;
}

export async function downloadDigestPdf(digest: Digest): Promise<void> {
  const doc = await buildDigestPdf(digest);
  const d = new Date(digest.generatedAt);
  const stamp = (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
  doc.save(`market-radar-briefing-${stamp}.pdf`);
}
