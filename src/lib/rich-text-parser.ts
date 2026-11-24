export const IMAGE_URL_ONLY_RE =
  /^(?:https?:\/\/\S+\.(?:png|jpe?g|webp|gif|svg)(?:\?\S*)?|\/question-images\/\S+\.(?:png|jpe?g|webp|gif|svg)(?:\?\S*)?|\/question-svgs\/\S+\.svg(?:\?\S*)?)$/i;

export function isImageUrlString(val?: string | null): boolean {
  if (!val) return false;
  return IMAGE_URL_ONLY_RE.test(val.trim());
}

export const LATEX_SYMBOLS: Record<string, string> = {
  '\\times': '×',
  '\\cdot': '·',
  '\\div': '÷',
  '\\pm': '±',
  '\\mp': '∓',
  '\\leq': '≤',
  '\\le': '≤',
  '\\geq': '≥',
  '\\ge': '≥',
  '\\neq': '≠',
  '\\ne': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\subset': '⊂',
  '\\subseteq': '⊆',
  '\\supset': '⊃',
  '\\supseteq': '⊇',
  '\\in': '∈',
  '\\notin': '∉',
  '\\emptyset': '∅',
  '\\varnothing': '∅',
  '\\land': '∧',
  '\\wedge': '∧',
  '\\lor': '∨',
  '\\vee': '∨',
  '\\neg': '¬',
  '\\lnot': '¬',
  '\\to': '→',
  '\\rightarrow': '→',
  '\\leftarrow': '←',
  '\\leftrightarrow': '↔',
  '\\Rightarrow': '⇒',
  '\\implies': '⇒',
  '\\Leftarrow': '⇐',
  '\\Leftrightarrow': '⇔',
  '\\iff': '⇔',
  '\\uparrow': '↑',
  '\\downarrow': '↓',
  '\\therefore': '∴',
  '\\because': '∵',
  '\\dots': '…',
  '\\ldots': '…',
  '\\cdots': '⋯',
  '\\square': '□',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\infty': '∞',
  '\\circ': '°',
  '\\degree': '°',
  '\\angle': '∠',
  '\\triangle': '△',
  '\\perp': '⊥',
  '\\parallel': '∥',
  '\\sim': '∼',
  '\\cong': '≅',
  '\\sum': '∑',
  '\\prod': '∏',
  '\\int': '∫',
  '\\pi': 'π',
  '\\theta': 'θ',
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\Delta': 'Δ',
  '\\sigma': 'σ',
  '\\mu': 'μ',
  '\\lambda': 'λ',
  '\\omega': 'ω',
  '\\Omega': 'Ω',
  '\\{': '{',
  '\\}': '}',
  '\\%': '%',
  '\\_': '_',
  '\\&': '&',
  '\\$': '$',
  '\\quad': '  ',
  '\\qquad': '    ',
  '\\,': ' ',
  '\\;': ' ',
  '\\!': '',
};

export function readBracedGroup(
  src: string,
  startIdx: number
): { content: string; nextIdx: number } | null {
  if (startIdx >= src.length || src[startIdx] !== '{') return null;
  let depth = 0;
  let i = startIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { content: src.slice(startIdx + 1, i), nextIdx: i + 1 };
      }
    }
    i++;
  }
  return { content: src.slice(startIdx + 1), nextIdx: src.length };
}

export function readBracketGroup(
  src: string,
  startIdx: number
): { content: string; nextIdx: number } | null {
  if (startIdx >= src.length || src[startIdx] !== '[') return null;
  const endIdx = src.indexOf(']', startIdx + 1);
  if (endIdx === -1) return null;
  return { content: src.slice(startIdx + 1, endIdx), nextIdx: endIdx + 1 };
}

export function skipWs(src: string, idx: number): number {
  let i = idx;
  while (i < src.length && src[i] === ' ') i++;
  return i;
}

export function readLatexArg(
  src: string,
  startIdx: number
): { content: string; nextIdx: number } | null {
  const i = skipWs(src, startIdx);
  if (i >= src.length) return null;
  if (src[i] === '{') return readBracedGroup(src, i);
  if (src[i] === '\\') {
    const cmdMatch = /^\\[A-Za-z]+/.exec(src.slice(i));
    if (cmdMatch) {
      return { content: cmdMatch[0], nextIdx: i + cmdMatch[0].length };
    }
    const two = src.slice(i, i + 2);
    return { content: two, nextIdx: i + two.length };
  }
  return { content: src[i], nextIdx: i + 1 };
}

export function normalizeLatexDelimiters(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/<page_number[^>\n<]*>?/gi, '')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => `$$${inner.trim()}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `$${trimmed}$` : '';
    });

  // Auto-close unclosed <table ...> blocks defensively so raw tags never leak to UI
  const openTables = (cleaned.match(/<table\b/gi) || []).length;
  const closeTables = (cleaned.match(/<\/table>/gi) || []).length;
  if (openTables > closeTables) {
    cleaned = cleaned.replace(/<[a-zA-Z/][^>\n<]*$/g, '') + '</td></tr></table>';
  }
  const dblDollarCount = (cleaned.match(/\$\$/g) || []).length;
  if (dblDollarCount % 2 !== 0) {
    cleaned = `${cleaned}$$`;
  }
  return cleaned;
}

export interface ParsedCell {
  isHeader: boolean;
  colSpan: number;
  rowSpan: number;
  content: string;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, (ent) => {
    const lower = ent.toLowerCase();
    return HTML_ENTITY_MAP[lower] ?? ent;
  });
}

export function parseHtmlTable(tableHtml: string): ParsedCell[][] {
  const rows: ParsedCell[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rMatch: RegExpExecArray | null;
  while ((rMatch = rowRe.exec(tableHtml)) !== null) {
    const cells: ParsedCell[] = [];
    const cellRe = /<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = cellRe.exec(rMatch[1])) !== null) {
      const tag = cMatch[1].toLowerCase();
      const attrs = cMatch[2] || '';
      const colMatch = /colspan=["']?(\d+)/i.exec(attrs);
      const rowMatch = /rowspan=["']?(\d+)/i.exec(attrs);
      const withScripts = cMatch[3]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, (_m, inner: string) => {
          const t = inner.replace(/<[^>]+>/g, '').trim();
          return t ? `$^{${t}}$` : '';
        })
        .replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, (_m, inner: string) => {
          const t = inner.replace(/<[^>]+>/g, '').trim();
          return t ? `$_{${t}}$` : '';
        })
        .replace(/<[^>]+>/g, '');
      const rawInner = decodeHtmlEntities(withScripts).trim();
      cells.push({
        isHeader: tag === 'th',
        colSpan: colMatch ? Math.max(1, Number(colMatch[1])) : 1,
        rowSpan: rowMatch ? Math.max(1, Number(rowMatch[1])) : 1,
        content: rawInner,
      });
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}
