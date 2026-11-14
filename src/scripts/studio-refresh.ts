type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Value = { value: string; checked?: boolean };
type Snapshot = { tab: string; fields: Record<string, Value>; rows: Record<string, Record<string, Value>[]>; identity: Record<string, string>; message: string; error: string; links: { text: string; href: string }[]; scroll: number };
const key = 'yuuki-studio-guide-refresh';
const readValue = (field: Field): Value => ({ value: field.value, ...(field instanceof HTMLInputElement && field.type === 'checkbox' ? { checked: field.checked } : {}) });
const writeValue = (field: Field, value: Value) => { field.value = value.value; if (field instanceof HTMLInputElement && typeof value.checked === 'boolean') field.checked = value.checked; };

/** Wait for saves before Astro refreshes, then carry this guide across that refresh. */
export function initStudioRefresh(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-studio-form="guide"]')!;
  const pending = new Set<Promise<void>>();
  if (import.meta.hot) import.meta.hot.on('vite:beforeFullReload', async () => {
    await Promise.all([...pending]);
    if (root.querySelector('[data-studio-tab="guide"]')?.getAttribute('aria-selected') !== 'true') return;
    const output = form.querySelector<HTMLElement>('[data-save-result]')!;
    const message = output.cloneNode(true) as HTMLElement;
    message.querySelectorAll('a').forEach((link) => link.remove());
    const snapshot: Snapshot = {
      tab: 'guide', fields: {}, rows: {}, identity: {}, message: message.textContent ?? '', error: output.dataset.error ?? 'false',
      links: Array.from(output.querySelectorAll<HTMLAnchorElement>('a')).map((link) => ({ text: link.textContent ?? '', href: link.getAttribute('href') ?? '' })), scroll: window.scrollY,
    };
    form.querySelectorAll<Field>('[name]').forEach((field) => { snapshot.fields[field.name] = readValue(field); });
    form.querySelectorAll<HTMLElement>('[data-repeater]').forEach((group) => {
      snapshot.rows[group.dataset.repeater!] = Array.from(group.querySelectorAll('[data-rows] .repeat-row')).map((row) => {
        const values: Record<string, Value> = {};
        row.querySelectorAll<Field>('[data-key]').forEach((field) => { values[field.dataset.key!] = readValue(field); });
        return values;
      });
    });
    for (const name of ['guideId', 'sourceHash', 'uploadId']) if (form.dataset[name]) snapshot.identity[name] = form.dataset[name]!;
    try { sessionStorage.setItem(key, JSON.stringify(snapshot)); } catch { /* Storage can be disabled by the browser. */ }
  });
  return {
    beginSave() {
      let finish!: () => void;
      const promise = new Promise<void>((resolve) => { finish = resolve; });
      pending.add(promise);
      return () => { pending.delete(promise); finish(); };
    },
    restore() {
      try {
        const saved = sessionStorage.getItem(key); sessionStorage.removeItem(key);
        if (!saved) return;
        const snapshot = JSON.parse(saved) as Snapshot;
        if (snapshot.tab !== 'guide') return;
        root.querySelector<HTMLButtonElement>('[data-studio-tab="guide"]')!.click();
        form.querySelectorAll<Field>('[name]').forEach((field) => { if (snapshot.fields[field.name]) writeValue(field, snapshot.fields[field.name]); });
        form.querySelectorAll<HTMLElement>('[data-repeater]').forEach((group) => {
          for (const values of snapshot.rows[group.dataset.repeater!] ?? []) {
            group.querySelector<HTMLButtonElement>('[data-add-row]')!.click();
            group.querySelector('[data-rows]')!.lastElementChild!.querySelectorAll<Field>('[data-key]').forEach((field) => { if (values[field.dataset.key!]) writeValue(field, values[field.dataset.key!]); });
          }
        });
        for (const name of ['guideId', 'sourceHash', 'uploadId']) if (snapshot.identity[name]) form.dataset[name] = snapshot.identity[name];
        if (form.dataset.guideId) {
          (form.elements.namedItem('slug') as HTMLInputElement).readOnly = true;
          form.querySelector('[data-guide-save-label]')!.textContent = 'Save guide changes';
          root.querySelector<HTMLSelectElement>('[data-guide-select]')!.value = form.dataset.guideId;
        }
        const output = form.querySelector<HTMLElement>('[data-save-result]')!;
        output.textContent = snapshot.message; output.dataset.error = snapshot.error;
        for (const item of snapshot.links) {
          if (!/^\/(?:studio\/preview\/guides|guides)\/[a-z0-9-]+\/$/.test(item.href)) continue;
          const link = document.createElement('a'); link.textContent = item.text; link.href = item.href; output.append(link);
        }
        root.querySelector('[data-guide-load-status]')!.textContent = 'Your guide stayed open after the local site refreshed.';
        (form.elements.namedItem('body') as HTMLTextAreaElement).dispatchEvent(new Event('input', { bubbles: true }));
        (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, snapshot.scroll);
      } catch { /* A stale or unavailable transient snapshot must not break the studio. */ }
    },
  };
}
