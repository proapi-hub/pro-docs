// 把高频 markdown 模式转换为 MDX 组件
// 规则：
//  R1  H3 兄弟节点全部 "方式一/方式二/..." → Tabs
//  R2  H3 兄弟节点全部 平台关键词（Windows/macOS/Mac/Linux）→ Tabs
//  R3  H3 兄弟节点全部 客户端关键词（Claude Code/Codex/Gemini CLI）→ Tabs
//  R4  H3 兄弟节点全部 "（数字）xxx" 或 "数字、xxx" 编号 → Steps
//  R5  起始段 "**提示/注意/警告/重要/建议**" → Callout
//  R6  FAQ 文件（faq/*.mdx）的 H3 全部 → Accordions
//  R7  index/login/register 里 "**方式一/二**" 段落 → Tabs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('content/docs');

const ICOMP = {
  tabs: "import { Tab, Tabs } from 'fumadocs-ui/components/tabs';",
  steps: "import { Step, Steps } from 'fumadocs-ui/components/steps';",
  callout: "import { Callout } from 'fumadocs-ui/components/callout';",
  accordion: "import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';",
};

function ensureImports(text, needed) {
  if (needed.size === 0) return text;
  const imports = [...needed].map((k) => ICOMP[k]).filter(Boolean);
  const fmMatch = text.match(/^---\n[\s\S]*?\n---\n/);
  if (!fmMatch) return imports.join('\n') + '\n\n' + text;
  const head = text.slice(0, fmMatch[0].length);
  const rest = text.slice(fmMatch[0].length);
  // 跳过已经存在的 import
  const existing = new Set(rest.match(/^import[^\n]+$/gm) ?? []);
  const toAdd = imports.filter((line) => !existing.has(line));
  if (toAdd.length === 0) return text;
  return head.trimEnd() + '\n\n' + toAdd.join('\n') + '\n\n' + rest.trimStart();
}

// 将一段 markdown 切割成 [pre, h2 块列表]
// 注意：代码块（``` 包裹）内的 # 不应被识别为标题
function splitByH2(body) {
  const lines = body.split('\n');
  const sections = [];
  let intro = [];
  let current = null;
  let inFence = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) inFence = !inFence;
    if (!inFence && /^## /.test(l)) {
      if (current) sections.push(current);
      current = { header: l, body: [] };
    } else {
      (current ? current.body : intro).push(l);
    }
  }
  if (current) sections.push(current);
  return { intro: intro.join('\n'), sections };
}

// 在 H2 内部按 H3 切割（同样跳过代码块内的 ###）
function splitByH3(body) {
  const lines = body.split('\n');
  const groups = [];
  let pre = [];
  let current = null;
  let inFence = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) inFence = !inFence;
    if (!inFence && /^### /.test(l)) {
      if (current) groups.push(current);
      current = { title: l.replace(/^###\s+/, '').trim(), body: [] };
    } else {
      (current ? current.body : pre).push(l);
    }
  }
  if (current) groups.push(current);
  return { pre: pre.join('\n'), groups };
}

const isWay = (t) => /^方式[一二三四五六]/.test(t);
const isPlatform = (t) => /^(Windows|macOS|Mac OS|Mac|Linux|Ubuntu)\b/.test(t) || /^(Windows|macOS|Linux).*配置/.test(t);
const isClient = (t) => /^(Claude Code|Codex|Gemini( CLI)?)/i.test(t);
const numberedTitle = (t) => {
  const m = t.match(/^（(\d+)）\s*(.*)$/) || t.match(/^\((\d+)\)\s*(.*)$/) || t.match(/^(\d+)\.\s+(.*)$/) || t.match(/^(\d+)、\s*(.*)$/);
  return m ? { n: Number(m[1]), label: m[2] } : null;
};

function allMatch(arr, fn) {
  return arr.length >= 2 && arr.every((g) => fn(g.title));
}

function tabsOf(groups, labels) {
  const inner = groups
    .map((g, i) => `<Tab value="${labels[i]}">\n\n${g.body.join('\n').trim()}\n\n</Tab>`)
    .join('\n');
  return `<Tabs items={${JSON.stringify(labels)}}>\n${inner}\n</Tabs>\n`;
}

function stepsOf(groups) {
  const inner = groups
    .map((g) => {
      const n = numberedTitle(g.title);
      const title = n ? n.label : g.title;
      const body = g.body.join('\n').trim();
      return `<Step>\n\n**${title}**\n\n${body}\n\n</Step>`;
    })
    .join('\n');
  return `<Steps>\n${inner}\n</Steps>\n`;
}

// R8: 裸平台名分段。检测 H3 section 内 N>=2 行 单独一行只有平台名，切分为 Tabs
const PLATFORM_LINE_RE = /^(Windows|MacOS|macOS|Mac OS|Mac|Linux|Ubuntu|Debian|RedHat|CentOS|Arch)$/i;

function transformBarePlatformBlocks(body) {
  const lines = body.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    // 找连续段：当前行是裸平台名，且前一非空行是空行或边界
    if (PLATFORM_LINE_RE.test(lines[i].trim()) && (i === 0 || lines[i - 1].trim() === '')) {
      // 收集后续 [tabHead, content...] 直到下一段或下一个 H3
      const tabs = [];
      let j = i;
      while (j < lines.length) {
        if (!PLATFORM_LINE_RE.test(lines[j].trim())) break;
        const platform = lines[j].trim();
        j++;
        // 跳过空行
        while (j < lines.length && lines[j].trim() === '') j++;
        // 收集内容直到下一个裸平台名前的空行 / H3 / 任何 JSX 标签边界
        // 关键：进入 ``` 代码块后，内部所有行无条件 push，遇到结束 ``` 才恢复检测
        const content = [];
        let inFence = false;
        while (j < lines.length) {
          const raw = lines[j];
          if (/^\s*```/.test(raw)) {
            inFence = !inFence;
            content.push(raw);
            j++;
            continue;
          }
          if (inFence) {
            content.push(raw);
            j++;
            continue;
          }
          if (/^### /.test(raw)) break;
          if (/^## /.test(raw)) break;
          if (/^<\/?[A-Za-z]/.test(raw.trim())) break;
          if (PLATFORM_LINE_RE.test(raw.trim()) && content.length > 0 && content.at(-1).trim() === '') break;
          content.push(raw);
          j++;
        }
        // 修整尾部空行
        while (content.length && content.at(-1).trim() === '') content.pop();
        tabs.push({ platform, content: content.join('\n') });
      }
      if (tabs.length >= 2) {
        const labels = tabs.map((t) => t.platform);
        const block =
          `<Tabs items={${JSON.stringify(labels)}}>\n` +
          tabs.map((t) => `<Tab value="${t.platform}">\n\n${t.content}\n\n</Tab>`).join('\n') +
          `\n</Tabs>\n`;
        out.push(block);
        i = j;
        continue;
      }
    }
    out.push(lines[i]);
    i++;
  }
  return out.join('\n');
}

// 转换 callout：把段首形如 `**提示**：xxx` 或 `**注意**：xxx` 的整段（直到空行）变 Callout
function transformCallouts(text) {
  return text.replace(
    /(^|\n\n)\*\*(提示|注意|警告|重要|建议|TIP|NOTE|WARNING)\*\*[：:]\s*([\s\S]*?)(?=\n\n|$)/g,
    (m, lead, kind, body) => {
      const type =
        /警告|WARNING|重要/.test(kind) ? 'warn' : /建议|TIP|提示/.test(kind) ? 'tip' : 'info';
      return `${lead}<Callout type="${type}">\n${body.trim()}\n</Callout>`;
    },
  );
}

// 主转换：作用于 H2 section 内的 H3 组
function transformH3Group(groups, needed) {
  if (groups.length < 2) return null;

  // R1 方式
  if (allMatch(groups, isWay)) {
    needed.add('tabs');
    return tabsOf(groups, groups.map((g) => g.title));
  }
  // R2 平台
  if (allMatch(groups, isPlatform)) {
    needed.add('tabs');
    return tabsOf(groups, groups.map((g) => g.title));
  }
  // R3 客户端
  if (allMatch(groups, isClient)) {
    needed.add('tabs');
    return tabsOf(groups, groups.map((g) => g.title));
  }
  // R4 编号
  if (groups.every((g) => numberedTitle(g.title))) {
    needed.add('steps');
    return stepsOf(groups);
  }
  return null;
}

function transformFile(file, relPath) {
  let text = fs.readFileSync(file, 'utf8');
  const fmMatch = text.match(/^---\n[\s\S]*?\n---\n/);
  const fm = fmMatch?.[0] ?? '';
  let body = text.slice(fm.length);

  const needed = new Set();
  let changed = false;

  // R6: FAQ 整体 Accordions
  if (/\/faq\//.test(relPath)) {
    const firstH3 = body.search(/^### /m);
    if (firstH3 !== -1 && !body.includes('<Accordions')) {
      const intro = body.slice(0, firstH3);
      const qaBlock = body.slice(firstH3);
      const sections = qaBlock.split(/^### /m).filter(Boolean);
      const items = sections.map((sec) => {
        const nl = sec.indexOf('\n');
        const title = sec.slice(0, nl).trim().replace(/"/g, '\\"');
        const content = sec.slice(nl + 1).trim();
        return `<Accordion title="${title}">\n\n${content}\n\n</Accordion>`;
      });
      body = intro + `<Accordions type="multiple">\n\n${items.join('\n\n')}\n\n</Accordions>\n`;
      needed.add('accordion');
      changed = true;
    }
  }
  if (/\/faq\//.test(relPath)) {
    // FAQ 文件已转为 Accordions，跳过其它结构性转换（避免跨边界破坏）
    if (changed) {
      let final = fm + body;
      final = ensureImports(final, needed);
      fs.writeFileSync(file, final);
      return true;
    }
    return false;
  }
  {
    // H2 内 H3 组 → Tabs/Steps
    const { intro, sections } = splitByH2(body);
    const rebuilt = sections.map((sec) => {
      const { pre, groups } = splitByH3(sec.body.join('\n'));
      const converted = transformH3Group(groups, needed);
      if (converted) {
        changed = true;
        return sec.header + '\n' + pre.trimEnd() + (pre.trim() ? '\n\n' : '') + converted;
      }
      return sec.header + '\n' + sec.body.join('\n');
    });
    body = intro + (intro && rebuilt.length ? '\n' : '') + rebuilt.join('\n');
  }

  // R8 裸平台名分段 → Tabs
  const afterPlatform = transformBarePlatformBlocks(body);
  if (afterPlatform !== body) {
    needed.add('tabs');
    changed = true;
    body = afterPlatform;
  }

  // R5 Callout
  const after = transformCallouts(body);
  if (after !== body) {
    needed.add('callout');
    changed = true;
    body = after;
  }

  // R7 index/login/register **方式一/二** 块
  if (/(index|login|register)\.mdx$/.test(relPath)) {
    const before = body;
    body = body.replace(
      /\*\*方式一[^*]*\*\*\n([\s\S]*?)\n\*\*方式二[^*]*\*\*\n([\s\S]*?)(?=\n## |\n---|$)/,
      (_, one, two) =>
        `<Tabs items={['方式一（推荐）', '方式二']}>\n<Tab value="方式一（推荐）">\n\n${one.trim()}\n\n</Tab>\n<Tab value="方式二">\n\n${two.trim()}\n\n</Tab>\n</Tabs>`,
    );
    body = body.replace(
      /## 使用 Google[^\n]*\n([\s\S]*?)\n## 使用邮箱[^\n]*\n([\s\S]*?)(?=\n## |\n---|$)/,
      (_, google, mail) =>
        `## 登录方式\n\n<Tabs items={['Google 账号', '邮箱 / 用户名']}>\n<Tab value="Google 账号">\n\n${google.trim()}\n\n</Tab>\n<Tab value="邮箱 / 用户名">\n\n${mail.trim()}\n\n</Tab>\n</Tabs>`,
    );
    if (body !== before) {
      needed.add('tabs');
      changed = true;
    }
  }

  if (!changed) return false;
  let final = fm + body;
  final = ensureImports(final, needed);
  fs.writeFileSync(file, final);
  return true;
}

function listMdx(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMdx(full));
    else if (e.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

const files = listMdx(ROOT);
let changed = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  try {
    if (transformFile(f, rel)) {
      console.log('✓', rel);
      changed++;
    }
  } catch (e) {
    console.error('✗', rel, e.message);
  }
}
console.log(`\nDone. ${changed}/${files.length} files updated.`);
