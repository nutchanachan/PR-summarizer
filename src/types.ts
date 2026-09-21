export interface ChangedFile {
  filename: string;
  status: string; // added | modified | removed | renamed
  additions: number;
  deletions: number;
  patch?: string; // GitHub ไม่ส่ง patch มาสำหรับไฟล์ binary หรือใหญ่มาก
}

export interface PullRequestInfo {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  commits: string[];
  files: ChangedFile[];
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** ทุก provider ต้อง implement interface นี้ ตัวอื่นในระบบรู้จักแค่ตรงนี้ */
export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<string>;
}
