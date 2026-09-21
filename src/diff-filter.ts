import type { ChangedFile } from "./types.ts";

/** ไฟล์ที่ไม่ช่วยให้เข้าใจ PR แต่กิน token เยอะ */
const IGNORE_PATTERNS: RegExp[] = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock|Gemfile\.lock|packages\.lock\.json)$/,
  /(^|\/)(dist|build|out|target|bin|obj|node_modules|vendor|\.next|coverage)\//,
  /\.min\.(js|css)$/,
  /\.(map|snap|png|jpe?g|gif|ico|svg|pdf|woff2?|ttf|zip|jar|dll|exe)$/i,
  /(^|\/)__generated__\//,
  /\.generated\.\w+$/,
];

/** รูปแบบ secret ที่พบบ่อย ถูกแทนก่อนส่ง diff ออกไปหาผู้ให้บริการ LLM */
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/g, // AWS access key
  /gh[pousr]_[A-Za-z0-9]{36,}/g, // GitHub token
  /github_pat_[A-Za-z0-9_]{50,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g, // OpenAI / Anthropic style
  /AIza[0-9A-Za-z_-]{35}/g, // Google API key
  /xox[abpr]-[A-Za-z0-9-]{10,}/g, // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /((?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'])(?!\[REDACTED\])[^"'\n]{6,}(["'])/gi,
];

export function isIgnored(filename: string): boolean {
  return IGNORE_PATTERNS.some((p) => p.test(filename));
}

export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(p, (_m, pre?: string, post?: string) => {
      count++;
      return typeof pre === "string" && typeof post === "string" ? `${pre}[REDACTED]${post}` : "[REDACTED]";
    });
  }
  return { text: out, count };
}

export interface FilteredDiff {
  included: ChangedFile[];
  ignored: string[]; // ตัดทิ้งเพราะเป็น lock/build/binary
  truncated: string[]; // ใส่แค่ชื่อไฟล์ เพราะเกินงบตัวอักษร
  redactions: number;
}

/**
 * กรองไฟล์ไม่สำคัญ, ลบ secret, และตัดให้พอดีงบ maxChars
 * เรียงไฟล์ที่เปลี่ยนน้อยก่อน เพื่อให้ได้ภาพรวมหลายไฟล์ แทนที่จะหมดงบกับไฟล์ใหญ่ไฟล์เดียว
 * (สัปดาห์ 2: เปลี่ยนเป็นแบ่ง chunk แล้วสรุปทีละส่วน ดู summarize.ts)
 */
export function filterDiff(files: ChangedFile[], maxChars: number): FilteredDiff {
  const result: FilteredDiff = { included: [], ignored: [], truncated: [], redactions: 0 };
  const candidates = files.filter((f) => {
    if (isIgnored(f.filename) || f.patch === undefined) {
      result.ignored.push(f.filename);
      return false;
    }
    return true;
  });
  candidates.sort((a, b) => a.additions + a.deletions - (b.additions + b.deletions));

  let used = 0;
  for (const f of candidates) {
    const { text, count } = redactSecrets(f.patch ?? "");
    if (used + text.length > maxChars) {
      result.truncated.push(f.filename);
      continue;
    }
    used += text.length;
    result.redactions += count;
    result.included.push({ ...f, patch: text });
  }
  return result;
}

/** แปลง unified diff (เช่นจาก `git diff`) เป็น ChangedFile[] ใช้ตอนรัน CLI กับไฟล์ diff ในเครื่อง */
export function parseUnifiedDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const chunks = diff.split(/^diff --git /m).filter((c) => c.trim());
  for (const chunk of chunks) {
    const header = chunk.split("\n", 1)[0] ?? "";
    const m = header.match(/a\/(\S+) b\/(\S+)/);
    if (!m) continue;
    const lines = chunk.split("\n");
    const hunkStart = lines.findIndex((l) => l.startsWith("@@"));
    const patchLines = hunkStart >= 0 ? lines.slice(hunkStart) : [];
    const status = /^new file/m.test(chunk) ? "added" : /^deleted file/m.test(chunk) ? "removed" : m[1] !== m[2] ? "renamed" : "modified";
    files.push({
      filename: m[2]!,
      status,
      additions: patchLines.filter((l) => l.startsWith("+")).length,
      deletions: patchLines.filter((l) => l.startsWith("-")).length,
      patch: /^Binary files/m.test(chunk) ? undefined : patchLines.join("\n"),
    });
  }
  return files;
}
