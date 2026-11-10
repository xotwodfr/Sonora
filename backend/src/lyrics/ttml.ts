import type { LyricLine, LyricSyllable } from './types.js';

/**
 * TTML (Timed Text Markup Language) lyrics parser, as used by Apple Music and
 * Spicy Lyrics community syncs.
 *
 * Supports line-timed and word/syllable-timed files, background vocals
 * (ttm:role="x-bg"), duets (ttm:agent) and the usual time expressions: clock
 * time (hh:mm:ss.fff, mm:ss.fff, ss.fff) and offset time (12.5s, 300ms, 2m, 1h,
 * ticks). No XML library: the subset lyrics use is small and a tiny tokenizer
 * keeps the packaged app lean.
 */

interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: Array<XmlNode | string>;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) attrs[m[1]] = decode(m[2] ?? m[3] ?? '');
  return attrs;
}

function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [] };
  const stack: XmlNode[] = [root];
  // Skip comments, CDATA wrappers, processing instructions and doctype.
  const src = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;'))
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');
  const re = /<(\/?)([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      top.children.push(decode(m[5]));
    } else if (m[1] === '/') {
      // Closing tag: pop to the matching open element (tolerate sloppy files).
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === m[2]) { stack.length = i; break; }
      }
    } else {
      const node: XmlNode = { name: m[2], attrs: parseAttrs(m[3]), children: [] };
      top.children.push(node);
      if (m[4] !== '/') stack.push(node);
    }
  }
  return root;
}

const local = (name: string) => name.slice(name.indexOf(':') + 1).toLowerCase();

function attr(node: XmlNode, name: string): string | undefined {
  for (const [k, v] of Object.entries(node.attrs)) if (local(k) === name) return v;
  return undefined;
}

function* elements(node: XmlNode): Generator<XmlNode> {
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    yield c;
    yield* elements(c);
  }
}

function textOf(node: XmlNode): string {
  return node.children.map((c) => (typeof c === 'string' ? c : local(c.name) === 'br' ? ' ' : textOf(c))).join('');
}

/** Parse a TTML time expression into seconds, or null. */
export function parseTtmlTime(value: string | undefined, tickRate = 10_000_000): number | null {
  if (!value) return null;
  const v = value.trim();
  let m = /^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(v);
  if (m) return (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
  m = /^(\d+(?:\.\d+)?)(h|ms|m|s|f|t)?$/.exec(v);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'h': return n * 3600;
    case 'm': return n * 60;
    case 'ms': return n / 1000;
    case 't': return n / tickRate;
    case 'f': return n / 30;
    default: return n; // 's' or bare seconds
  }
}

export interface TtmlResult {
  /** True when at least one line carries a timestamp. */
  synced: boolean;
  lines: LyricLine[];
}

export function parseTtml(xml: string): TtmlResult {
  const doc = parseXml(xml);
  let tt: XmlNode | undefined;
  for (const el of elements(doc)) { if (local(el.name) === 'tt') { tt = el; break; } }
  if (!tt) return { synced: false, lines: [] };

  const tickRate = Number(attr(tt, 'tickrate')) || undefined;
  const t = (v: string | undefined) => parseTtmlTime(v, tickRate);

  // Duets: the first agent sings on the main side, any other on the opposite.
  const agents: string[] = [];
  const agentIndex = (id: string | undefined) => {
    if (!id) return 0;
    let i = agents.indexOf(id);
    if (i < 0) { agents.push(id); i = agents.length - 1; }
    return i;
  };

  const lines: LyricLine[] = [];
  let synced = false;

  for (const p of elements(tt)) {
    if (local(p.name) !== 'p') continue;
    const begin = t(attr(p, 'begin'));
    const end = t(attr(p, 'end'));
    const syllables: LyricSyllable[] = [];
    const bgParts: string[] = [];
    let leadText = '';
    let pendingSpace = false;

    const walk = (node: XmlNode) => {
      for (const c of node.children) {
        if (typeof c === 'string') {
          const txt = c.replace(/\s+/g, ' ');
          if (!txt.trim()) { if (syllables.length) pendingSpace = true; continue; }
          if (/^\s/.test(txt) && syllables.length) pendingSpace = true;
          leadText += txt;
          continue;
        }
        const name = local(c.name);
        if (name === 'br') { pendingSpace = true; continue; }
        if (name !== 'span') continue;
        const role = attr(c, 'role');
        if (role === 'x-translation' || role === 'x-roman') continue;
        if (role === 'x-bg') {
          const b = textOf(c).replace(/\s+/g, ' ').trim();
          if (b) bgParts.push(b);
          continue;
        }
        const hasSpanChild = c.children.some((k) => typeof k !== 'string' && local(k.name) === 'span');
        const sBegin = t(attr(c, 'begin'));
        const sEnd = t(attr(c, 'end'));
        if (hasSpanChild) { walk(c); continue; }
        const word = textOf(c);
        if (!word.trim()) { pendingSpace = true; continue; }
        if (sBegin !== null && sEnd !== null) {
          if (syllables.length && !pendingSpace) syllables[syllables.length - 1].partOfWord = true;
          syllables.push({ text: word.trim(), start: sBegin, end: sEnd });
          leadText += (pendingSpace && leadText ? ' ' : '') + word.trim();
        } else {
          leadText += (pendingSpace && leadText ? ' ' : '') + word.trim();
        }
        pendingSpace = /\s$/.test(word);
      }
    };
    walk(p);

    // Rebuild text from syllables when present so spacing follows partOfWord.
    let text = syllables.length
      ? syllables.map((s, i) => s.text + (s.partOfWord || i === syllables.length - 1 ? '' : ' ')).join('')
      : leadText.replace(/\s+/g, ' ').trim();
    if (bgParts.length) {
      const bg = bgParts.join(' ').trim();
      // Sources usually include their own parentheses; don't double them.
      text = `${text} ${/^\(.*\)$/.test(bg) ? bg : `(${bg})`}`.trim();
    }
    if (!text) continue;

    const time = begin ?? (syllables.length ? syllables[0].start : null);
    if (time !== null) synced = true;
    const line: LyricLine = {
      time: time ?? 0,
      text,
    };
    const lineEnd = end ?? (syllables.length ? syllables[syllables.length - 1].end : null);
    if (lineEnd !== null) line.end = lineEnd;
    if (agentIndex(attr(p, 'agent')) % 2 === 1) line.oppositeAligned = true;
    if (syllables.length) line.syllables = syllables;
    lines.push(line);
  }

  if (synced) lines.sort((a, b) => a.time - b.time);
  return { synced, lines };
}
