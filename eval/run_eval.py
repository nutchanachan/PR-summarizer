"""
วัดคุณภาพสรุป PR แบบอัตโนมัติ (ใช้แค่ Python standard library)

    python3 eval/run_eval.py                      # ใช้ provider จาก .env
    LLM_PROVIDER=anthropic python3 eval/run_eval.py
    python3 eval/run_eval.py --only 001           # รันเฉพาะเคสที่ id ขึ้นต้นด้วย 001

แต่ละเคสใน eval/dataset/*.json มี:
    must_mention      กลุ่มของ regex ต้องเจออย่างน้อย 1 ตัวในแต่ละกลุ่ม  -> วัด "ครบถ้วน"
    must_not_mention  regex ที่ไม่ควรเจอ (เรื่องที่ไม่มีใน diff)         -> วัด "ไม่แต่งเรื่อง"
และทุกเคสถูกเช็กว่ามีหัวข้อครบตาม format ที่ prompt กำหนด                  -> วัด "ทำตาม format"

ขั้นต่อไป (สัปดาห์ 2): เพิ่ม LLM-as-judge เทียบกับ reference_summary และเก็บผลแต่ละรอบไว้เทียบกัน
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "eval" / "dataset"
OUTPUT_DIR = ROOT / "eval" / "output"
REQUIRED_SECTIONS = ["## สรุป", "## การเปลี่ยนแปลงหลัก", "## จุดที่ควรรีวิวละเอียด", "## สิ่งที่อาจตกหล่น"]


@dataclass
class CaseResult:
    case_id: str
    summary: str = ""
    seconds: float = 0.0
    error: str | None = None
    covered: list[bool] = field(default_factory=list)
    hallucinated: list[str] = field(default_factory=list)
    sections_ok: bool = False

    @property
    def coverage(self) -> float:
        if self.error:
            return 0.0
        return sum(self.covered) / len(self.covered) if self.covered else 1.0

    @property
    def passed(self) -> bool:
        return self.error is None and self.coverage == 1.0 and not self.hallucinated and self.sections_ok


def generate_summary(case: dict, case_path: Path) -> str:
    """เรียก CLI ของฝั่ง TypeScript ให้สรุป แล้วเอา stdout มาใช้"""
    if "diff_file" in case:
        target = ["--diff", str((case_path.parent / case["diff_file"]).resolve()), "--title", case.get("title", "")]
    else:
        target = [case["pr_url"]]
    proc = subprocess.run(
        ["npx", "--no-install", "tsx", "src/cli.ts", *target],
        cwd=ROOT, capture_output=True, text=True, timeout=300,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"exit {proc.returncode}")
    return proc.stdout


def score(case: dict, summary: str, result: CaseResult) -> None:
    for group in case.get("must_mention", []):
        result.covered.append(any(re.search(p, summary, re.IGNORECASE) for p in group))
    result.hallucinated = [p for p in case.get("must_not_mention", []) if re.search(p, summary, re.IGNORECASE)]
    result.sections_ok = all(s in summary for s in REQUIRED_SECTIONS)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="รันเฉพาะเคสที่ id ขึ้นต้นด้วยค่านี้")
    args = parser.parse_args()

    cases = sorted(DATASET_DIR.glob("*.json"))
    results: list[CaseResult] = []
    for path in cases:
        case = json.loads(path.read_text(encoding="utf-8"))
        if args.only and not case["id"].startswith(args.only):
            continue
        r = CaseResult(case_id=case["id"])
        start = time.monotonic()
        try:
            r.summary = generate_summary(case, path)
            score(case, r.summary, r)
        except Exception as exc:  # เก็บ error ไว้ในรายงาน แล้วรันเคสถัดไปต่อ
            r.error = str(exc)
        r.seconds = time.monotonic() - start
        results.append(r)
        status = "PASS" if r.passed else "FAIL"
        print(f"[{status}] {r.case_id}  coverage={r.coverage:.0%}  hallucinated={r.hallucinated or '-'}  "
              f"format={'ok' if r.sections_ok else 'missing'}  {r.seconds:.1f}s" + (f"  error={r.error}" if r.error else ""))

    if not results:
        print("ไม่พบเคสใน eval/dataset")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report = OUTPUT_DIR / f"report-{stamp}.json"
    report.write_text(json.dumps([{**r.__dict__, "coverage": r.coverage, "passed": r.passed} for r in results],
                                 ensure_ascii=False, indent=2), encoding="utf-8")

    passed = sum(r.passed for r in results)
    avg_cov = sum(r.coverage for r in results) / len(results)
    print(f"\nผ่าน {passed}/{len(results)} เคส · coverage เฉลี่ย {avg_cov:.0%} · รายงาน: {report.relative_to(ROOT)}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
