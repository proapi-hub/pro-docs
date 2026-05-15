'use client';
import { useEffect, useRef, useState } from 'react';

interface PyodideAPI {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (cfg: { batched: (s: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (opts?: { indexURL?: string }) => Promise<PyodideAPI>;
  }
}

export function PythonRunner({ code }: { code: string }) {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const pyRef = useRef<PyodideAPI | null>(null);

  useEffect(() => {
    if (document.querySelector('script[data-pyodide]')) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
    script.async = true;
    script.dataset.pyodide = 'true';
    script.onload = async () => {
      if (!window.loadPyodide) return;
      const py = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      });
      pyRef.current = py;
      setReady(true);
    };
    document.body.appendChild(script);
  }, []);

  const run = async () => {
    if (!pyRef.current) return;
    setLoading(true);
    setOutput('');
    let buf = '';
    pyRef.current.setStdout({ batched: (s: string) => (buf += s + '\n') });
    try {
      await pyRef.current.runPythonAsync(code);
      setOutput(buf || '(no output)');
    } catch (e) {
      setOutput(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-4 rounded-md border border-fd-border p-3">
      <pre className="text-sm overflow-x-auto bg-fd-muted p-2 rounded">
        <code>{code}</code>
      </pre>
      <button
        onClick={run}
        disabled={!ready || loading}
        className="mt-2 px-3 py-1 text-sm rounded bg-fd-primary text-fd-primary-foreground disabled:opacity-50"
      >
        {!ready ? '加载 Pyodide 中...' : loading ? '运行中...' : '▶ 运行 Python'}
      </button>
      {output && (
        <pre className="mt-2 text-sm bg-fd-muted p-2 rounded whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}
