# PR Summarizer

สรุป pull request อัตโนมัติด้วย LLM แล้วคอมเมนต์ลง PR สลับผู้ให้บริการได้ด้วยการเปลี่ยน env ตัวเดียว
(Anthropic, OpenAI, Gemini หรือ `mock` ที่ไม่ต้องใช้ key)

## เริ่มใช้งาน (5 นาที)

```bash
npm install
cp .env.example .env          # ค่าเริ่มต้นคือ LLM_PROVIDER=mock
npm test                      # unit test
npm run dev -- --diff examples/sample.diff
```

พอพร้อมใช้ LLM จริง แก้ `.env`:

```bash
LLM_PROVIDER=anthropic        # หรือ openai / gemini
ANTHROPIC_API_KEY=...
LLM_MODEL=                    # เว้นว่าง = ใช้ default ใน src/llm/<provider>.ts
```

## วิธีรัน CLI

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev -- --diff examples/sample.diff` | สรุปจากไฟล์ diff |
| `git diff main \| npm run dev -- --diff -` | สรุปงานที่ยังไม่ได้เปิด PR |
| `npm run dev -- https://github.com/o/r/pull/1` | สรุป PR จริง พิมพ์ออก terminal (PR ใน repo private ต้องมี `GITHUB_TOKEN`) |
| `... --post` | โพสต์ หรืออัปเดตคอมเมนต์ใน PR |
| `... --show-prompt` | ดู prompt ที่ส่งไปจริง ใช้ตอนปรับ prompt |

## โครงสร้าง

```
src/
  index.ts        จุดเริ่มต้นเมื่อรันเป็น GitHub Action
  cli.ts          จุดเริ่มต้นเมื่อรันในเครื่อง
  config.ts       อ่านค่าจาก .env หรือ input ของ Action
  github.ts       ดึง PR/diff และโพสต์คอมเมนต์ (อัปเดตคอมเมนต์เดิม ไม่สร้างซ้ำ)
  diff-filter.ts  ตัด lock/build/binary, ปิดบัง secret, คุมขนาด diff
  prompts.ts      system prompt + รูปแบบ output
  summarize.ts    รวมทุกส่วนเข้าด้วยกัน
  llm/            provider แต่ละเจ้า ใช้ interface เดียวกัน (LLMProvider ใน types.ts)
eval/             สคริปต์ Python วัดคุณภาพสรุป
.github/workflows/pr-summary.yml   ตัวอย่างการใช้ใน repo
```

### เพิ่มผู้ให้บริการใหม่

1. สร้าง `src/llm/<ชื่อ>.ts` ที่ implement `LLMProvider` (มีแค่ method `complete`)
2. เพิ่ม case ใน `src/llm/index.ts` และชื่อใน `src/config.ts`

OpenAI-compatible API (เช่น Ollama, OpenRouter, Azure) ใช้ `OpenAIProvider` ได้เลย แค่ส่ง `baseUrl` ต่างกัน

## Evaluation

```bash
python3 eval/run_eval.py
```

เพิ่มเคสได้ที่ `eval/dataset/*.json` โดยแต่ละเคสระบุสิ่งที่สรุป**ต้องพูดถึง** และ**ห้ามพูดถึง**
ถ้ารันด้วย `mock` เคสจะ FAIL ซึ่งถูกต้องแล้ว เพราะ mock สรุปไม่ครบ เป็นหลักฐานว่า eval จับได้จริง
ลองรันกับแต่ละ provider แล้วเทียบคะแนน, เวลา และค่าใช้จ่าย

## ใช้เป็น GitHub Action

1. `npm run build` แล้ว commit โฟลเดอร์ `dist/` ด้วย (Action รันจาก `dist/index.js`)
   (workflow `check-dist` จะ fail ถ้าลืม build — ดู `.github/workflows/check-dist.yml`)
2. ที่ repo: Settings → Secrets and variables → Actions
   - Secret `LLM_API_KEY` = key ของผู้ให้บริการ
   - Variable `LLM_PROVIDER` = `anthropic` / `openai` / `gemini`
3. เปิด PR แล้วรอคอมเมนต์สรุป

## ความปลอดภัยที่มีแล้ว และสิ่งที่ยังต้องทำ

มีแล้ว
- ขอสิทธิ์เท่าที่จำเป็น (`contents: read`, `pull-requests: write`)
- ไม่รันกับ PR จาก fork
- ปิดบัง secret รูปแบบที่พบบ่อยก่อนส่ง diff ออกไป
- แยกข้อมูล PR ไว้ใน `<pr_data>` และสั่ง model ว่าไม่ต้องทำตามคำสั่งในนั้น (กัน prompt injection ขั้นพื้นฐาน)

ยังไม่มี (งานสัปดาห์ 3)
- ตัวกรอง secret ยังจับได้ไม่หมด ควรเพิ่ม pattern หรือใช้เครื่องมืออย่าง gitleaks
- ยังไม่ได้ตรวจ output ว่ามีลิงก์หรือ mention แปลกๆ ที่มาจาก prompt injection

> ก่อนใช้กับโค้ดบริษัท ตรวจนโยบายก่อนว่าอนุญาตให้ส่งโค้ดไปยังผู้ให้บริการ LLM เจ้าไหนได้บ้าง

## แผนต่อไป

- **สัปดาห์ 2**: แบ่ง diff ใหญ่เป็นส่วน สรุปทีละส่วนแล้วรวม (ตอนนี้ไฟล์ที่เกินงบถูกข้าม), เพิ่มเคส eval เป็น 20-30 เคสจาก PR จริง, เพิ่ม LLM-as-judge
- **สัปดาห์ 3**: ความปลอดภัยตามหัวข้อด้านบน
- **สัปดาห์ 4**: ให้ทีมลองใช้ เก็บฟีดแบ็ก เขียนบล็อก
