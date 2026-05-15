import { source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const pages = source.getPages();
  const items = pages
    .map(
      (p) => `<item>
  <title><![CDATA[${p.data.title}]]></title>
  <link>${base}${p.url}</link>
  <description><![CDATA[${p.data.description ?? ''}]]></description>
</item>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>New API Docs</title>
    <link>${base}</link>
    <description>API 文档更新</description>
    ${items}
  </channel>
</rss>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
}
