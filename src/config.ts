export type ProviderName = "anthropic" | "openai" | "gemini" | "mock";

export interface Config {
  provider: ProviderName;
  model?: string;
  apiKey?: string;
  language: "th" | "en";
  maxDiffChars: number;
}

const PROVIDERS: ProviderName[] = ["anthropic", "openai", "gemini", "mock"];
const KEY_ENV: Record<ProviderName, string | undefined> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  mock: undefined,
};

/**
 * อ่านค่าจาก env ปกติ หรือจาก input ของ GitHub Action (ซึ่งถูกส่งมาเป็น INPUT_<NAME>)
 */
export function readVar(name: string, env = process.env): string | undefined {
  const v = env[name] ?? env[`INPUT_${name}`];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function loadConfig(env = process.env): Config {
  const provider = (readVar("LLM_PROVIDER", env) ?? "mock").toLowerCase() as ProviderName;
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`LLM_PROVIDER ไม่รู้จัก: "${provider}" (ใช้ได้: ${PROVIDERS.join(", ")})`);
  }
  const keyEnv = KEY_ENV[provider];
  const apiKey = keyEnv ? readVar(keyEnv, env) ?? readVar("LLM_API_KEY", env) : undefined;
  if (keyEnv && !apiKey) {
    throw new Error(`ต้องตั้งค่า ${keyEnv} (หรือ LLM_API_KEY) เมื่อใช้ provider "${provider}"`);
  }
  const language = readVar("SUMMARY_LANGUAGE", env) === "en" ? "en" : "th";
  return {
    provider,
    model: readVar("LLM_MODEL", env),
    apiKey,
    language,
    maxDiffChars: Number(readVar("MAX_DIFF_CHARS", env) ?? 60_000),
  };
}
