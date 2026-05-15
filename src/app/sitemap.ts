import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    ...source.getPages().map((p) => ({
      url: `${base}${p.url}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
