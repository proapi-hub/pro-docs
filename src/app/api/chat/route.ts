import { createOpenAI } from '@ai-sdk/openai';
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';
import { source } from '@/lib/source';
import { getAllowedModels, isAllowedModel } from '@/lib/models';
import { Document, type DocumentData } from 'flexsearch';

interface CustomDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
}

export type ChatUIMessage = UIMessage<
  never,
  {
    client: {
      location: string;
      pageTitle?: string;
    };
  }
>;

const searchServer = createSearchServer();

async function createSearchServer() {
  const search = new Document<CustomDocument>({
    document: {
      id: 'url',
      index: ['title', 'description', 'content'],
      store: true,
    },
  });

  const docs = await chunkedAll(
    source.getPages().map(async (page) => {
      if (!('getText' in page.data)) return null;
      return {
        title: page.data.title,
        description: page.data.description,
        url: page.url,
        content: await page.data.getText('processed'),
      } as CustomDocument;
    }),
  );
  for (const doc of docs) if (doc) search.add(doc);
  return search;
}

async function chunkedAll<O>(promises: Promise<O>[]): Promise<O[]> {
  const SIZE = 50;
  const out: O[] = [];
  for (let i = 0; i < promises.length; i += SIZE) {
    out.push(...(await Promise.all(promises.slice(i, i + SIZE))));
  }
  return out;
}

// 兼容 OpenAI 协议的私有网关；API Key 留在服务端
const llm = createOpenAI({
  baseURL: process.env.PROAPI_BASE_URL,
  apiKey: process.env.PROAPI_API_KEY,
});

const systemPrompt = [
  '你是 ProAPI 文档站的智能问答助手。',
  '工作流程：',
  '1. 用户消息中可能包含 `[Client Context: {"location":"/path","pageTitle":"..."}]` —— 这是用户当前所在的文档页面，仅供参考。',
  '2. 当用户用 "这个页面 / 当前页 / 这篇" 等指代时，把 `pageTitle` 当作主要检索关键词调用 `search`。',
  '3. 调用 `search` 时只传中文/英文关键词，**绝对不要**传整段 URL 或自然语言长句。',
  '4. 第一次结果不理想时，更换关键词重试（最多 3 次）。',
  '5. 基于 `search` 返回的片段作答，并用 markdown 链接 `[标题](url)` 注明来源。',
  '6. 若仍检索不到，告诉用户检索为空并建议替代关键词。',
  '默认使用简体中文回答，语气专业且简洁。',
].join('\n');

export async function POST(req: Request) {
  const reqJson = (await req.json()) as {
    messages?: ChatUIMessage[];
    model?: string;
  };

  // 白名单校验，防止前端用任意 model 绕过
  const allowed = await getAllowedModels();
  const fallback = process.env.PROAPI_DEFAULT_MODEL ?? allowed[0];
  const modelId =
    reqJson.model && isAllowedModel(reqJson.model, allowed) ? reqJson.model : fallback;

  const result = streamText({
    model: llm.chat(modelId),
    stopWhen: stepCountIs(5),
    tools: { search: searchTool },
    messages: [
      { role: 'system', content: systemPrompt },
      ...(await convertToModelMessages<ChatUIMessage>(reqJson.messages ?? [], {
        convertDataPart(part) {
          if (part.type === 'data-client')
            return {
              type: 'text',
              text: `[Client Context: ${JSON.stringify(part.data)}]`,
            };
        },
      })),
    ],
    toolChoice: 'auto',
  });

  return result.toUIMessageStreamResponse();
}

export type SearchTool = typeof searchTool;

const searchTool = tool({
  description: 'Search the docs content and return raw JSON results.',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().int().min(1).max(100).default(10),
  }),
  async execute({ query, limit }) {
    const search = await searchServer;
    return await search.searchAsync(query, { limit, merge: true, enrich: true });
  },
});
