'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

export interface PdfViewerHandle { goTo: (page: number) => void }

/**
 * Renders a PDF onto canvases with pdf.js (from the `unpdf` package), so the
 * preview works the same in every browser — including ones without a built-in
 * PDF viewer (Android Chrome, embedded webviews). Loaded lazily on the client.
 */
const PdfViewer = forwardRef<PdfViewerHandle, {
  url: string;
  zoom: number | 'fit';
  onPageCount?: (n: number) => void;
  onPageChange?: (n: number) => void;
}>(function PdfViewer({ url, zoom, onPageCount, onPageChange }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);

  useImperativeHandle(ref, () => ({
    goTo(page: number) {
      const el = pagesRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }));

  // Track available width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setNumPages(0);
    setRendering(true);
    (async () => {
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Could not load the PDF (${res.status})`);
        }
        const data = new Uint8Array(await res.arrayBuffer());
        const { getDocumentProxy } = await import('unpdf');
        const pdf = await getDocumentProxy(data);
        if (cancelled) { pdf.destroy?.(); return; }
        docRef.current?.destroy?.();
        docRef.current = pdf;
        setNumPages(pdf.numPages);
        onPageCount?.(pdf.numPages);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message || 'Could not display the PDF'); setRendering(false); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => () => { docRef.current?.destroy?.(); }, []);

  // Render pages whenever doc / width / zoom change.
  useEffect(() => {
    const pdf = docRef.current;
    const host = pagesRef.current;
    if (!pdf || !host || !numPages || width < 50) return;
    let cancelled = false;
    const tasks: any[] = [];
    setRendering(true);
    const t = setTimeout(async () => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      for (let n = 1; n <= numPages; n++) {
        if (cancelled) return;
        try {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const fit = (width - 32) / base.width;
          // "fit" = page width; a number = percentage of true size (100% ≈ 96 dpi, as in desktop viewers).
          const scale = zoom === 'fit' ? fit : (zoom / 100) * (96 / 72);
          const vp = page.getViewport({ scale: scale * dpr });
          const canvas = host.querySelector<HTMLCanvasElement>(`canvas[data-page="${n}"]`);
          if (!canvas) continue;
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
          canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
          const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp });
          tasks.push(task);
          await task.promise;
        } catch (e: any) {
          if (e?.name === 'RenderingCancelledException') return;
        }
      }
      if (!cancelled) setRendering(false);
    }, 60);
    return () => { cancelled = true; clearTimeout(t); tasks.forEach((k) => k.cancel?.()); };
  }, [numPages, width, zoom]);

  // Current page from scroll position.
  useEffect(() => {
    const root = scrollRef.current;
    const host = pagesRef.current;
    if (!root || !host || !numPages) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) onPageChange?.(Number((vis.target as HTMLElement).dataset.page));
    }, { root, threshold: [0.25, 0.5, 0.75] });
    host.querySelectorAll('[data-page]').forEach((el) => { if (el.tagName === 'DIV') io.observe(el); });
    return () => io.disconnect();
  }, [numPages, onPageChange]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        <p className="max-w-xs text-sm text-slate-600">{error}</p>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple-700 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Open the PDF in a new tab
        </a>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-auto bg-slate-100" aria-label="PDF preview">
      {!numPages && (
        <div className="flex h-full items-center justify-center" role="status">
          <div className="w-3/5 max-w-[360px]"><div className="sk sk-soft aspect-[1/1.414] w-full rounded-md" /></div>
        </div>
      )}
      <div ref={pagesRef} className="flex flex-col items-center gap-4 p-4">
        {Array.from({ length: numPages }).map((_, i) => (
          <div key={i} data-page={i + 1} className="bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12),0_8px_24px_-12px_rgba(15,23,42,0.25)]">
            <canvas data-page={i + 1} role="img" aria-label={`Page ${i + 1} of ${numPages}`} className="block" />
          </div>
        ))}
      </div>
      {rendering && numPages > 0 && (
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm"><Loader2 className="h-3 w-3 animate-spin" />Rendering</span>
      )}
    </div>
  );
});

export default PdfViewer;
