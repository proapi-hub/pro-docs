// 抓取 MDX 中引用的远端图片到 public/ 并把 MDX 改为本地路径
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'node:fs/promises';

const ROOT = path.resolve('.');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONTENT_DIR = path.join(ROOT, 'content/docs');
const SOURCE_HOST = 'https://docs.packyapi.com'; // 真实可下载源
const PLACEHOLDER_HOST = 'https://apidocs.prorisehub.com'; // MDX 里目前的写法
const CONCURRENCY = 8;

async function readAllMdx() {
  const files = [];
  for await (const f of glob('**/*.{md,mdx}', { cwd: CONTENT_DIR })) {
    files.push(path.join(CONTENT_DIR, f));
  }
  return files;
}

function extractUrls(files) {
  const set = new Set();
  const re = /https:\/\/apidocs\.prorisehub\.com\/assets\/image\/[^)\s"'`<>]+/g;
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(re)) set.add(m[0]);
  }
  return [...set];
}

async function downloadOne(url) {
  // /assets/image/... 路径，保留原结构
  const u = new URL(url);
  const relPath = decodeURIComponent(u.pathname); // /assets/image/...
  const localFile = path.join(PUBLIC_DIR, relPath);
  if (fs.existsSync(localFile) && fs.statSync(localFile).size > 0) {
    return { url, relPath, status: 'cached' };
  }
  fs.mkdirSync(path.dirname(localFile), { recursive: true });
  const fetchUrl = SOURCE_HOST + u.pathname; // 用原始 percent-encoded 路径
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    return { url, relPath, status: `HTTP ${res.status}` };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localFile, buf);
  return { url, relPath, status: 'ok', bytes: buf.length };
}

async function downloadAll(urls) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const u = urls[idx];
      try {
        const r = await downloadOne(u);
        console.log(`[${idx + 1}/${urls.length}] ${r.status}  ${r.relPath}`);
        results.push(r);
      } catch (e) {
        console.log(`[${idx + 1}/${urls.length}] ERR  ${u}  ${e.message}`);
        results.push({ url: u, status: 'err', error: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function rewriteMdx(files, results) {
  const ok = new Set(results.filter((r) => r.status === 'ok' || r.status === 'cached').map((r) => r.url));
  for (const f of files) {
    let text = fs.readFileSync(f, 'utf8');
    let changed = false;
    text = text.replace(/https:\/\/apidocs\.prorisehub\.com(\/assets\/image\/[^)\s"'`<>]+)/g, (m, p) => {
      if (!ok.has(m)) return m; // 下载失败时保留原 URL
      const decoded = decodeURIComponent(p);
      changed = true;
      return decoded;
    });
    if (changed) fs.writeFileSync(f, text);
  }
}

const files = await readAllMdx();
const urls = extractUrls(files);
console.log(`Found ${urls.length} unique image URLs in ${files.length} mdx files`);
const results = await downloadAll(urls);
rewriteMdx(files, results);
const okCount = results.filter((r) => r.status === 'ok' || r.status === 'cached').length;
const failed = results.filter((r) => r.status !== 'ok' && r.status !== 'cached');
console.log(`\nDone: ${okCount}/${urls.length} downloaded, ${failed.length} failed`);
if (failed.length) console.log('Failed:', failed);
