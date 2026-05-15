'use client';
import { useEffect, useState } from 'react';

export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      const id = `mmd-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, chart);
      if (!cancelled) setSvg(svg);
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div
      className="my-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
