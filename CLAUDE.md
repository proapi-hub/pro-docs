# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

本仓库是 **ProAPI 中转站**（`newapi.prorisehub.com`）的官方文档站点。ProAPI 是一个面向国内开发者的 LLM API 中转/聚合服务，作用是为 **Claude Code、Codex、Gemini CLI** 等命令行工具及 OpenAI 兼容客户端，提供统一的 API Endpoint、令牌（Token）分组计费、以及人民币 1:1 充值能力。

核心业务概念（写文档时必须保持术语一致）：

- **令牌分组（Token Group）**：决定一个 API Key 能调用哪些模型（Claude Code 组 / Codex 组 / Gemini 组 / 绘图组等）。分组错配是用户常见问题来源。
- **API Endpoint**：主站 `https://newapi.prorisehub.com`；OpenAI 兼容客户端需追加 `/v1`，Claude Code / Gemini CLI 走专用配置。
- **CC-Switch**：第三方配置切换工具，文档中作为"一键切换多家供应商"方案重点介绍。
- **品牌迁移**：`batch-scrape-2026-05-13 (1).md` 是从 `packyapi.com`（旧站）爬取的原始素材，所有 mdx 内容已改写为 ProAPI 域名与品牌——新增/修改内容时不要回带 packy/PackyAPI 字样。

## 仓库结构

```
new-api-docs/
├── pro-docs/                         # ← 实际站点工程（Next.js + Fumadocs）
│   ├── content/docs/                 # MDX 文档源（按业务域分目录）
│   │   ├── index.mdx                 # 快速开始（首页）
│   │   ├── token/  api/  ccswitch/   # 令牌分组 / API 参考 / CC-Switch
│   │   ├── cli/  paint/  advanced/   # CLI 教程 / 绘图教程 / 进阶接入
│   │   ├── faq/  tos/                # 常见问题 / 条款
│   │   └── meta.json                 # 顶层目录顺序
│   ├── src/app/(docs)/[[...slug]]/   # Fumadocs 文档动态路由
│   ├── src/app/api/                  # Search route + AI/llms 路由
│   ├── src/lib/source.ts             # Fumadocs source loader
│   ├── src/lib/shared.ts             # appName / 路由前缀 / GitHub 配置
│   ├── src/components/               # api-page, markdown, mdx, mermaid, ai/, ui/
│   ├── proxy.ts                      # Next middleware：内容协商 .md 重写
│   ├── source.config.ts              # Fumadocs MDX 配置（remarkMath / KaTeX / twoslash）
│   ├── openapi.yaml                  # OpenAPI 规范（被 fumadocs-openapi 渲染）
│   ├── scripts/                      # import-docs / download-images / componentize
│   ├── Dockerfile  docker-compose.yml
│   └── package.json
└── batch-scrape-2026-05-13 (1).md    # packyapi 旧站抓取素材（仅参考，不要发布）
```

## 常用命令

所有命令在 `pro-docs/` 目录下运行（包管理器为 **pnpm**，见 `pnpm-lock.yaml`）：

```bash
pnpm install            # 触发 postinstall → fumadocs-mdx 生成 .source
pnpm dev                # 本地开发：http://localhost:3000
pnpm build              # 生产构建（next build，output: 'standalone'）
pnpm start              # 启动构建产物
pnpm lint               # ESLint（eslint-config-next）
pnpm types:check        # fumadocs-mdx + next typegen + tsc --noEmit
```

辅助脚本（`scripts/`）：

- `import-docs.mjs` — 从 `batch-scrape-*.md` 这类素材批量导入/转写为 MDX。
- `download-images.mjs` — 将文档中的远程图片落地到本地/CDN。
- `componentize.mjs` — 将纯 markdown 段落升级为 Fumadocs 组件（Tabs / Callout / Cards）。
- `server-bootstrap.sh` — 容器启动脚手架。

## 架构要点

- **Fumadocs v16 + Next.js 16 + React 19 + Tailwind v4**。文档源由 `fumadocs-mdx` 在 `postinstall` / dev 时编译到 `.source/`；`src/lib/source.ts` 通过 `loader()` 暴露页面树。
- **路由约定**（`src/lib/shared.ts`）：`docsRoute = '/'`，文档直接挂在站点根路径。`docsContentRoute = '/llms.mdx/docs'` 与 `docsImageRoute = '/og/docs'` 用于 LLM 友好的纯文本/OG 图副本。
- **proxy.ts（Next middleware）**：根据 `Accept` 头或 `.md` 后缀，把文档路径重写到 `content.md` 端点，支撑 `llms.txt` / `llms-full.txt` 与命令行抓取场景。
- **OpenAPI 渲染**：`openapi.yaml` 经 `src/lib/openapi.ts` 的 `createOpenAPI()` 注入，由 `components/api-page.tsx` 渲染到 `content/docs/api/` 下的页面。
- **MDX 能力**：开启 `remark-math` + `rehype-katex`（公式）、`fumadocs-twoslash`（TS 代码块悬浮类型）、Mermaid（`components/mermaid.tsx`）、Python 演示（`components/python-runner.tsx`）。`source.config.ts` 关闭了默认的 `remarkImageOptions`，图片走 `mdx-components` 的 `RawImg`。
- **AI / 搜索**：`src/app/api/` 含搜索路由与 `ai/` 子组件（基于 `@ai-sdk/react` + `@ai-sdk/openai` + `@openrouter/ai-sdk-provider`）。
- **部署**：`next.config.mjs` 输出 `standalone`；提供 `Dockerfile` + `docker-compose.yml` + `scripts/server-bootstrap.sh`。

## 写作约定

- 站名统一使用 **ProAPI**；域名统一使用 `newapi.prorisehub.com`。绝不出现 PackyAPI / packyapi.com（除非是历史对照说明）。
- 充值描述使用 `1:1` 比例与 **人民币** 表述；保留"无限额度受账户余额限制"等关键风险提示。
- 三大 CLI 教程（Claude Code / Codex / Gemini）必须强调"令牌分组要选对"，并交叉链接 `/token/intro` 与 `/faq/*`。
- 富文本组件：导航卡片用 `<Cards><Card>`，并列流程用 `<Tabs><Tab>`，关键提示用 `<Callout type="info|warn">`——保持与 `index.mdx` 风格一致。
- 中文与英文/数字之间留空格；命令、路径、按键用反引号或 `<kbd>`。
- 修改 `content/docs/*/meta.json` 时务必同步顶层 `content/docs/meta.json` 的顺序，决定侧边栏。
