interface SearchItem { title: string; description: string; url: string; type: string; keywords?: string; }
interface PagefindResult { data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string; filters?: Record<string, string[]> }> }
interface Pagefind { search: (query: string) => Promise<{ results: PagefindResult[] }>; init?: () => Promise<void>; }

export function initSearch() {
  const dialog = document.querySelector<HTMLDialogElement>('#command-palette');
  const input = document.querySelector<HTMLInputElement>('#global-search');
  const results = document.querySelector<HTMLElement>('#search-results');
  const status = document.querySelector<HTMLElement>('#search-status');
  if (!dialog || !input || !results || !status) return;
  let engine: Pagefind | null = null;
  let fallback: SearchItem[] = [];
  let ready: Promise<void> | undefined;
  let active = -1;
  let sequence = 0;
  let timer: ReturnType<typeof setTimeout>;
  const prepare = () => ready ??= (async () => {
    try {
      if (import.meta.env.DEV) throw new Error('Use the live content index in development.');
      const modulePath = '/pagefind/pagefind.js';
      engine = await import(/* @vite-ignore */ modulePath) as Pagefind;
      await engine.init?.();
    } catch { engine = null; }
    try { fallback = await fetch('/search-index.json').then((r) => r.ok ? r.json() : []); } catch { fallback = []; }
  })();
  const activate = (index: number) => {
    const links = Array.from(results.querySelectorAll<HTMLAnchorElement>('a'));
    active = links.length ? (index + links.length) % links.length : -1;
    links.forEach((link, i) => { link.dataset.active = String(i === active); });
    links[active]?.scrollIntoView({ block: 'nearest' });
  };
  const renderResults = (items: SearchItem[], total: number, query: string) => {
    results.replaceChildren(); active = -1;
    status.textContent = query ? `${total} result${total === 1 ? '' : 's'} for “${query}”` : 'A few places to start';
    for (const item of items) {
      const link = document.createElement('a'); link.href = item.url; link.setAttribute('role', 'listitem');
      for (const [className, value] of [['result-type', item.type], ['result-title', item.title], ['result-description', item.description]]) {
        const span = document.createElement('span'); span.className = className; span.textContent = value; link.append(span);
      }
      results.append(link);
    }
    if (!items.length) { const p = document.createElement('p'); p.className = 'no-results'; p.textContent = query ? 'No matches. Try a series, codec, or guide topic.' : 'Search will become available when content is added.'; results.append(p); }
  };
  const search = async () => {
    const current = ++sequence; const query = input.value.trim(); await prepare();
    let matches: SearchItem[];
    let total = 0;
    try {
      if (engine && query) {
        const response = await engine.search(query); total = response.results.length;
        matches = await Promise.all(response.results.slice(0, 8).map(async (result) => {
          const data = await result.data(); const text = new DOMParser().parseFromString(data.excerpt, 'text/html').body.textContent ?? '';
          return { title: data.meta.title ?? 'Yuuki archive', description: text, url: data.url, type: data.filters?.type?.[0] ?? 'Archive' };
        }));
      } else {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        matches = fallback.filter((item) => words.every((word) => `${item.title} ${item.description} ${item.keywords ?? ''} ${item.type}`.toLowerCase().includes(word)));
        total = matches.length; matches = matches.slice(0, 8);
      }
    } catch {
      engine = null;
      matches = fallback.filter((item) => `${item.title} ${item.description} ${item.keywords ?? ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8); total = matches.length;
    }
    if (current === sequence) renderResults(matches, total, query);
  };
  let trigger: HTMLElement | null = null;
  const open = () => { if (!dialog.open) { trigger = document.activeElement as HTMLElement; dialog.showModal(); } input.focus(); void search(); };
  dialog.addEventListener('close', () => trigger?.focus());
  document.querySelectorAll('[data-search-open]').forEach((button) => button.addEventListener('click', open));
  dialog.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 130); });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); activate(active + (event.key === 'ArrowDown' ? 1 : -1)); }
    if (event.key === 'Enter' && event.target === input) { event.preventDefault(); results.querySelectorAll<HTMLAnchorElement>('a')[Math.max(active, 0)]?.click(); }
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const typing = target.matches('input, textarea, select') || target.isContentEditable;
    if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !typing)) { event.preventDefault(); open(); }
  });
}
