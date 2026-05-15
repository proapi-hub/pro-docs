// 服务端：拉取网关模型并按白名单过滤
// 仅返回模型 id，绝不向客户端暴露 API Key
// 维护准则：稀有/昂贵/实验性模型一律不进白名单

export const MODEL_WHITELIST = new Set<string>([
  // Claude（仅 sonnet / haiku，不含 opus）
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-6',

  // Gemini（仅 3.1 lite/pro preview，不含 2.5 / 3.x / image）
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-pro-preview',

  // GPT（不含 5.3-codex-spark / 5.4 / image-2）
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5.3-codex',
  'gpt-5.4-mini',
  'gpt-5.5',
]);

let cache: { ids: string[]; expires: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getAllowedModels(): Promise<string[]> {
  if (cache && cache.expires > Date.now()) return cache.ids;

  const baseURL = process.env.PROAPI_BASE_URL!;
  const apiKey = process.env.PROAPI_API_KEY!;
  const res = await fetch(`${baseURL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Models API ${res.status}`);
  }
  const json: { data?: { id: string }[] } = await res.json();
  // 取 网关返回 ∩ 白名单，保证白名单里的模型在网关下线后自动消失
  const ids = (json.data ?? [])
    .map((m) => m.id)
    .filter((id) => MODEL_WHITELIST.has(id))
    .sort();

  cache = { ids, expires: Date.now() + TTL_MS };
  return ids;
}

export function isAllowedModel(id: string, allowed: string[]): boolean {
  return allowed.includes(id);
}
