/**
 * รันในเครื่องเพื่อทดลองและ debug ไม่โพสต์อะไรขึ้น GitHub เว้นแต่ใส่ --post
 *
 *   npm run dev -- --diff examples/sample.diff          สรุปจากไฟล์ diff ในเครื่อง
 *   git diff main | npm run dev -- --diff -             สรุปจาก stdin
 *   npm run dev -- https://github.com/o/r/pull/123      สรุป PR จริง (พิมพ์ออก terminal)
 *   npm run dev -- https://github.com/o/r/pull/123 --post
 *   เพิ่ม --show-prompt เพื่อดู prompt ที่ส่งไปจริง
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadConfig, readVar } from "./config.ts";
import { filterDiff, parseUnifiedDiff } from "./diff-filter.ts";
import { fetchPullRequest, parsePrUrl, upsertComment } from "./github.ts";
import { createProvider } from "./llm/index.ts";
import { buildMessages } from "./prompts.ts";
import { summarizePullRequest } from "./summarize.ts";
import type { PullRequestInfo } from "./types.ts";

try {
  process.loadEnvFile(".env");
} catch {
  /* ไม่มีไฟล์ .env ก็ใช้ env ปกติ */
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    diff: { type: "string" },
    title: { type: "string", default: "(local diff)" },
    post: { type: "boolean", default: false },
    "show-prompt": { type: "boolean", default: false },
  },
});

async function main() {
  const cfg = loadConfig();
  const llm = createProvider(cfg);
  const token = readVar("GITHUB_TOKEN");

  let pr: PullRequestInfo;
  if (values.diff) {
    const raw = readFileSync(values.diff === "-" ? 0 : values.diff, "utf8");
    pr = { owner: "local", repo: "local", number: 0, title: values.title!, body: "", commits: [], files: parseUnifiedDiff(raw) };
  } else if (positionals[0]) {
    const { owner, repo, number } = parsePrUrl(positionals[0]);
    pr = await fetchPullRequest(owner, repo, number, token);
  } else {
    console.error("ใส่ลิงก์ PR หรือ --diff <file> (ดูตัวอย่างบนหัวไฟล์ src/cli.ts)");
    process.exit(1);
  }

  if (values["show-prompt"]) {
    for (const m of buildMessages(pr, filterDiff(pr.files, cfg.maxDiffChars), cfg.language)) {
      console.log(`\n===== ${m.role} =====\n${m.content}`);
    }
    console.log("\n===== response =====");
  }

  const started = Date.now();
  const { markdown } = await summarizePullRequest(pr, llm, cfg);
  console.log(markdown);
  console.error(`\n[${llm.name}/${llm.model}] ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (values.post) {
    if (!token || pr.owner === "local") throw new Error("--post ต้องใช้กับลิงก์ PR และต้องมี GITHUB_TOKEN");
    const r = await upsertComment(pr.owner, pr.repo, pr.number, markdown, token);
    console.error(`คอมเมนต์ ${r.action}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
