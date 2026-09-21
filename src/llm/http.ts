/** fetch แบบมี timeout และ retry เมื่อเจอ 429/5xx (rate limit หรือเซิร์ฟเวอร์ล่มชั่วคราว) */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  { retries = 2, timeoutMs = 60_000 } = {},
): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    // ตัดข้อความ error ให้สั้น และไม่พิมพ์ header (ซึ่งมี API key) ออกมา
    const text = (await res.text()).slice(0, 500);
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }
}
