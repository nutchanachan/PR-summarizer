import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { filterDiff, isIgnored, parseUnifiedDiff, redactSecrets } from "../src/diff-filter.ts";

test("ข้าม lock file, build output และ binary", () => {
  assert.equal(isIgnored("package-lock.json"), true);
  assert.equal(isIgnored("apps/web/dist/main.js"), true);
  assert.equal(isIgnored("assets/logo.png"), true);
  assert.equal(isIgnored("src/Services/UserService.cs"), false);
});

test("ปิดบัง secret ก่อนส่งออก", () => {
  const { text, count } = redactSecrets('const key = "sk-abcdefghijklmnopqrstuvwxyz";\npassword: "hunter2hunter2"');
  assert.equal(count, 2);
  assert.doesNotMatch(text, /abcdefghijklmnop/);
  assert.doesNotMatch(text, /hunter2/);
});

test("parse unified diff จากตัวอย่าง", () => {
  const files = parseUnifiedDiff(readFileSync("examples/sample.diff", "utf8"));
  assert.deepEqual(files.map((f) => f.filename), ["src/auth/login.ts", "src/config.ts", "package-lock.json"]);
  assert.equal(files[0]!.status, "modified");
  assert.ok(files[0]!.additions > 0);
});

test("ไฟล์ที่เกินงบถูกตัด แต่ยังเก็บชื่อไว้", () => {
  const files = [
    { filename: "small.ts", status: "modified", additions: 1, deletions: 0, patch: "+a" },
    { filename: "big.ts", status: "modified", additions: 500, deletions: 0, patch: "+".repeat(1000) },
  ];
  const r = filterDiff(files, 100);
  assert.deepEqual(r.included.map((f) => f.filename), ["small.ts"]);
  assert.deepEqual(r.truncated, ["big.ts"]);
});
