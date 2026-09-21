import type { ChangedFile, PullRequestInfo } from "./types.ts";
import { COMMENT_MARKER } from "./summarize.ts";

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";

async function gh(token: string | undefined, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "pr-summarizer",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

/** ดึงทุกหน้าของ endpoint แบบ list (GitHub ให้สูงสุด 100 ต่อหน้า) */
async function paginate(token: string | undefined, path: string, maxPages = 30): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const items = await gh(token, `${path}${sep}per_page=100&page=${page}`);
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

export function parsePrUrl(url: string): { owner: string; repo: string; number: number } {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) throw new Error(`ไม่ใช่ลิงก์ PR ที่ถูกต้อง: ${url}`);
  return { owner: m[1]!, repo: m[2]!, number: Number(m[3]) };
}

export async function fetchPullRequest(owner: string, repo: string, number: number, token?: string): Promise<PullRequestInfo> {
  const base = `/repos/${owner}/${repo}/pulls/${number}`;
  const [pr, files, commits] = await Promise.all([
    gh(token, base),
    paginate(token, `${base}/files`),
    paginate(token, `${base}/commits`),
  ]);
  return {
    owner,
    repo,
    number,
    title: pr.title,
    body: pr.body ?? "",
    commits: commits.map((c: any) => String(c.commit.message).split("\n")[0] ?? ""),
    files: files.map(
      (f: any): ChangedFile => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      }),
    ),
  };
}

/** ถ้าเคยคอมเมนต์ไว้แล้ว ให้แก้คอมเมนต์เดิม แทนการสร้างใหม่ทุกครั้งที่ push */
export async function upsertComment(owner: string, repo: string, number: number, body: string, token: string) {
  const comments = await paginate(token, `/repos/${owner}/${repo}/issues/${number}/comments`);
  const existing = comments.find((c: any) => typeof c.body === "string" && c.body.includes(COMMENT_MARKER));
  if (existing) {
    await gh(token, `/repos/${owner}/${repo}/issues/comments/${existing.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
    return { action: "updated" as const, id: existing.id };
  }
  const created = await gh(token, `/repos/${owner}/${repo}/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  return { action: "created" as const, id: created.id };
}
