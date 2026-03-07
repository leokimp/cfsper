// ─── Encoding Utilities ───────────────────────────────────────────────────────

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export function safeAtob(input: string): string {
  const str = String(input).replace(/[=]+$/, "");
  if (str.length % 4 === 1) return input;
  let output = "";
  let bc = 0, bs = 0, i = 0;
  while (i < str.length) {
    const ch    = str[i++];
    const idx   = B64_CHARS.indexOf(ch);
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> (-2 * bc & 6)));
    }
  }
  return output;
}

export function safeBtoa(input: string): string {
  const str = String(input);
  let output = "";
  for (
    let block = 0, charCode: number, i = 0, map = B64_CHARS;
    str.charAt(i | 0) || ((map = "="), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4));
    if (charCode > 255) return input;
    block = (block << 8) | charCode;
  }
  return output;
}

// ─── String Similarity ────────────────────────────────────────────────────────

function seqRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0 && lb === 0) return 1;
  const dp: number[][] = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  let best = 0;
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : 0;
      if (dp[i][j] > best) best = dp[i][j];
    }
  return (2 * best) / (la + lb);
}

function jaccardWords(a: string, b: string): number {
  const sa = new Set(a.split(/\s+/).filter(Boolean));
  const sb = new Set(b.split(/\s+/).filter(Boolean));
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

export function calcTitleSim(query: string, candidate: string): number {
  const norm = (s: string) =>
    s.replace(/&amp;/gi, "&")
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const q = norm(query), c = norm(candidate);
  if (!q || !c) return 0;
  if (c.includes(q)) return 0.95;
  return Math.max(seqRatio(q, c), jaccardWords(q, c));
}

// ─── Size Utilities ───────────────────────────────────────────────────────────

export function parseSize(str: string): number {
  const match = str.match(/([\d.]+)\s*(GB|MB|KB|TB)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return value * (multipliers[unit] ?? 0);
}

export function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };
  return value * (multipliers[unit] ?? 0);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "Unknown";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ─── HTML Utilities ───────────────────────────────────────────────────────────

export function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export interface AnchorLink {
  href: string;
  text: string;
}

export function extractAllLinks(html: string): AnchorLink[] {
  const links: AnchorLink[] = [];
  const regex = new RegExp(`<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\\/a>`, "gis");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    links.push({ href: match[1], text: extractText(match[2]) });
  }
  return links;
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
