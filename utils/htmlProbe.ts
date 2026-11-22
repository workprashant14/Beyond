/**
 * A small, dependency-free HTML structure probe, used by scripts/probe-satellite-elements.ts to describe a page's tables WITHOUT
 * interpreting them: for each <table> it records the nearest headings and short text lines before it, the header cells, the row count
 * and the first rows. It deliberately does not know anything about satellites. It is for learning an unseen page layout safely.
 */
export interface ProbedTable {
  index: number;
  /** Nearest preceding headings (h1 to h4), nearest last. */
  headings: string[];
  /** Short text lines between the previous table (or the start) and this one, e.g. "Epoch: ..." lines. */
  textBefore: string[];
  headerCells: string[];
  rowCount: number;
  firstRows: string[][];
  /** Number of data rows whose cell count differs from the header's. */
  ragged: number;
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&omega;/g, "ω").replace(/&Omega;/g, "Ω").replace(/&deg;/g, "°").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const text = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

export function probeTables(rawHtml: string, maxFirstRows = 2, maxTextLines = 6): ProbedTable[] {
  // Scripts, styles and comments can contain text that looks like tables; they are not part of the page's content.
  const html = rawHtml.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const out: ProbedTable[] = [];
  const tableRe = /<table\b[\s\S]*?<\/table>/gi;
  let last = 0, m: RegExpExecArray | null, index = 0;
  const headings: string[] = [];
  while ((m = tableRe.exec(html))) {
    const before = html.slice(last, m.index);
    for (const h of before.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)) { const t = text(h[1]); if (t) headings.push(t); }
    const lines = text(before.replace(/<h[1-4]\b[\s\S]*?<\/h[1-4]>/gi, " ").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")).split(/\n| {2,}/).map((s) => s.trim()).filter((s) => s.length > 0 && s.length < 400);
    // The text above is whitespace-collapsed, so split "Epoch:" and "Ephemeris:" style labels onto their own lines.
    const textBefore = lines.flatMap((l) => l.split(/(?=\b(?:Epoch|Ephemeris|Reference|Frame|Note)s?:)/)).map((s) => s.trim()).filter(Boolean).slice(-maxTextLines);
    const rows: string[][] = [];
    for (const tr of m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) rows.push([...tr[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1])));
    const nonEmpty = rows.filter((r) => r.length > 0);
    const header = nonEmpty[0] ?? [];
    const data = nonEmpty.slice(1);
    out.push({ index: index++, headings: headings.slice(-3), textBefore, headerCells: header, rowCount: data.length, firstRows: data.slice(0, maxFirstRows), ragged: data.filter((r) => r.length !== header.length).length });
    last = m.index + m[0].length;
  }
  return out;
}

export function formatProbe(tables: readonly ProbedTable[], source: string): string {
  const lines = [`# Page structure probe`, `Source: ${source}`, `Tables found: ${tables.length}`, ""];
  for (const t of tables) {
    lines.push(`## Table ${t.index}`);
    lines.push(`Headings above (nearest last): ${t.headings.length ? t.headings.map((h) => JSON.stringify(h)).join(" > ") : "(none)"}`);
    lines.push(`Text lines before: ${t.textBefore.length ? t.textBefore.map((x) => JSON.stringify(x)).join(" | ") : "(none)"}`);
    lines.push(`Header cells (${t.headerCells.length}): ${t.headerCells.map((h) => JSON.stringify(h)).join(", ")}`);
    lines.push(`Data rows: ${t.rowCount} (rows whose cell count differs from the header: ${t.ragged})`);
    t.firstRows.forEach((r, i) => lines.push(`Row ${i + 1}: ${r.map((c) => JSON.stringify(c)).join(", ")}`));
    lines.push("");
  }
  return lines.join("\n");
}
