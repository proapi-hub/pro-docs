// 一次性把 batch-scrape 源文件按章节切片为 fumadocs 站点的多个 mdx
import fs from 'node:fs';
import path from 'node:path';

const SRC = '/Volumes/DataDisk/OpenSourceProjects/new-api-docs/batch-scrape-2026-05-13 (1).md';
const OUT = path.resolve('content/docs');

// [起始行, 结束行(含), 相对路径, title, description, 是否首页(可空)]
const SECTIONS = [
  [48, 261,  'index.mdx',                 '快速开始',       '从 0 开始的 PackyAPI 使用之旅，覆盖注册、充值、令牌与 CLI'],
  // 快速上手（getting-started）已并入首页"快速开始"，不再单独生成
  [554, 859, 'token/intro.mdx',              '分组介绍',  '令牌分组的概念与使用方式'],
  [860, 899, 'token/view-groups.mdx',        '令牌分组查看', '查看最新分组与可用模型'],
  [900, 951, 'token/groups.mdx',             '令牌分组详细', '各类分组的特性与配额说明'],
  [952, 1374,'ccswitch/index.mdx',           'CC-Switch 使用教程', 'CC-Switch 桌面客户端的完整使用指南'],
  [1375,1471,'ccswitch/common.mdx',          '通用步骤',  'CC-Switch 各客户端共用配置流程'],
  [1472,1483,'ccswitch/claude-code.mdx',     'Claude Code 配置', '在 CC-Switch 中配置 Claude Code'],
  [1484,1539,'ccswitch/codex.mdx',           'Codex 配置', '在 CC-Switch 中配置 Codex'],
  [1540,1595,'ccswitch/gemini.mdx',          'Gemini 配置', '在 CC-Switch 中配置 Gemini'],
  [1596,1835,'ccswitch/cli.mdx',             'CC Switch CLI 使用', 'CC Switch CLI 的安装、命令与配置'],
  [1836,2066,'cli/index.mdx',                'CLI 配置教程', '手动 CLI 配置入口与命令一览'],
  [2067,2150,'cli/env-check.mdx',            '环境检查',   '手动 CLI 配置前的环境检查'],
  [2151,2241,'cli/claude-code.mdx',          'Claude Code 配置', '手动配置 Claude Code CLI'],
  [2242,2396,'cli/codex.mdx',                'Codex 配置', '手动配置 Codex CLI'],
  [2397,2464,'cli/gemini.mdx',               'Gemini 配置', '手动配置 Gemini CLI'],
  [2465,2533,'paint/banana.mdx',             'Nano Banana 2 Pro 绘图教程', '使用 Cherry Studio 调用 Nano Banana 2 Pro 绘图'],
  [2534,2815,'paint/gpt-image.mdx',          'GPT-Image-2 绘图教程', 'GPT-Image-2 接口调用与 Cherry Studio 集成'],
  [2816,2915,'advanced/claude-desktop.mdx',  'Claude Desktop', 'Claude Desktop 安装与第三方接口配置'],
  [2916,3058,'advanced/aion-ui.mdx',         'AionUI',     'AionUI 介绍、下载与模型配置'],
  [3059,3152,'advanced/opencode.mdx',        'OpenCode',   'OpenCode 项目环境与验证'],
  [3153,3311,'advanced/openclaw.mdx',        'OpenClaw',   'OpenClaw 安装、渠道模型、浏览器与 Telegram Bot 访问'],
  [3312,3413,'advanced/deepseek-cc.mdx',     'DeepSeek 接入 Claude Code', '使用 DeepSeek 令牌通过 CC-Switch 接入 Claude Code'],
  [3414,3602,'faq/claude-code.mdx',          'Claude Code 相关问题', 'Claude Code 常见问题与排查'],
  [3603,3880,'faq/codex.mdx',                'Codex 相关问题', 'Codex 常见问题与排查'],
  [3881,4002,'faq/gemini.mdx',               'Gemini 相关问题', 'Gemini 常见问题与排查'],
  [4003,4035,'tos/index.mdx',                '条款与政策',  'PackyAPI 条款与政策导览'],
  [4036,4193,'tos/aup.mdx',                  '使用政策 (AUP)', '可接受使用政策（Acceptable Use Policy）'],
  [4194,4368,'tos/service-terms.mdx',        '服务条款',   'PackyAPI 服务条款全文'],
  [4369,4487,'tos/specific-terms.mdx',       '服务特定条款', '面向特定服务模式的补充条款'],
  [4488,4584,'tos/supported-regions.mdx',    '支持的国家和地区', 'API 服务支持的国家、地区与限制说明'],
];

// 文件夹的 meta.json
const METAS = {
  '.':                { title: 'ProAPI 文档', pages: ['index', 'token', 'ccswitch', 'cli', 'paint', 'advanced', 'faq', 'tos'] },
  'token':            { title: '令牌与分组', pages: ['intro', 'view-groups', 'groups'] },
  'ccswitch':         { title: 'CC-Switch', pages: ['index', 'common', 'claude-code', 'codex', 'gemini', 'cli'] },
  'cli':              { title: 'CLI 配置', pages: ['index', 'env-check', 'claude-code', 'codex', 'gemini'] },
  'paint':            { title: '绘图教程', pages: ['banana', 'gpt-image'] },
  'advanced':         { title: '进阶用法', pages: ['claude-desktop', 'aion-ui', 'opencode', 'openclaw', 'deepseek-cc'] },
  'faq':              { title: '常见问题', pages: ['claude-code', 'codex', 'gemini'] },
  'tos':              { title: '条款与政策', pages: ['index', 'aup', 'service-terms', 'specific-terms', 'supported-regions'] },
};

function escapeFM(s) {
  return s.replace(/"/g, '\\"');
}

// 清洗内容
function clean(raw, title) {
  let lines = raw.split('\n');

  // 去掉首行(就是大段标题)的若干重复 H2
  // 找到第一个非 H2/空行 的位置作为正文开始
  while (lines.length && /^(\s*$|## )/.test(lines[0])) {
    if (lines[0].startsWith('## ') && !lines[0].startsWith('## [')) {
      lines.shift();
      continue;
    }
    if (lines[0].trim() === '') {
      lines.shift();
      continue;
    }
    break;
  }

  // 把 `## [标题](url)` 转换为 `## 标题`（去除来源锚点链接）
  lines = lines.map((l) => l.replace(/^(#{1,6}) \[([^\]]+)\]\([^)]+\)\s*$/, '$1 $2'));

  // 删掉 "[Packy Team](...)2025/...大约 N 分钟..." 这种页眉行
  lines = lines.filter((l) => !/^\[Packy Team\]\(.*?\).*?分钟.*$/.test(l));

  // MDX 不支持 <url> 自动链接 — 转为 [url](url)
  lines = lines.map((l) => l.replace(/<(https?:\/\/[^>\s]+)>/g, '[$1]($1)'));

  // 移除 HTML 注释（MDX 也不支持）
  lines = lines.map((l) => l.replace(/<!--[\s\S]*?-->/g, '').replace(/<!---->/g, ''));

  // 移除 "[上一页|下一页](url)" 与紧随其后的标题链接行（fumadocs 自带 prev/next）
  {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i];
      if (/^\[(?:上一页|下一页)\]\([^)]*\)\s*$/.test(cur)) {
        if (i + 1 < lines.length && /^\[[^\]]+\]\([^)]*\)\s*$/.test(lines[i + 1])) i++;
        continue;
      }
      out.push(cur);
    }
    lines = out;
  }

  // 徽标行末尾的硬换行 "\" 去掉，使相邻徽标在同段内联（自动 flex-wrap）
  lines = lines.map((l) =>
    /\]\([^)]*\)\\\s*$/.test(l) && /img\.shields\.io|badge\/|trendshift\.io/.test(l)
      ? l.replace(/\\\s*$/, ' ')
      : l,
  );

  // 把非代码块文本里的 { } 转义为 \{ \}，避免 MDX 把它当作 JSX 表达式
  let inFence = false;
  lines = lines.map((l) => {
    if (/^\s*```/.test(l)) {
      inFence = !inFence;
      return l;
    }
    if (inFence) return l;
    // 跳过行内代码 `...` 部分，仅对其外的 { } 做转义
    return l.replace(/`[^`]*`|([{}])/g, (m, brace) => {
      if (!brace) return m;
      return brace === '{' ? '\\{' : '\\}';
    });
  });

  // 多个空行合一
  const out = [];
  let blank = false;
  for (const l of lines) {
    if (l.trim() === '') {
      if (!blank) out.push('');
      blank = true;
    } else {
      out.push(l);
      blank = false;
    }
  }

  // 转义 KaTeX 风险字符不需要 — 本文档无公式

  return out.join('\n').trim() + '\n';
}

const src = fs.readFileSync(SRC, 'utf8').split('\n');

// 清理旧的 docs（保留 meta.json 待会覆写）
function rmRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rmRecursive(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}
rmRecursive(OUT);
fs.mkdirSync(OUT, { recursive: true });

for (const [start, end, rel, title, desc] of SECTIONS) {
  const slice = src.slice(start - 1, end).join('\n');
  const body = clean(slice, title);
  const fm = `---\ntitle: "${escapeFM(title)}"\ndescription: "${escapeFM(desc)}"\n---\n\n`;
  const full = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, fm + body);
  console.log('✓', rel);
}

for (const [folder, meta] of Object.entries(METAS)) {
  const dir = folder === '.' ? OUT : path.join(OUT, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

console.log('Done.');
