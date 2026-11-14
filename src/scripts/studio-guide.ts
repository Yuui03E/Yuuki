import { hasAdultMedia } from '../lib/audience.mjs';
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function initGuideEditor(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-studio-form="guide"]')!;
  const select = root.querySelector<HTMLSelectElement>('[data-guide-select]')!;
  const status = root.querySelector<HTMLElement>('[data-guide-load-status]')!;
  const load = root.querySelector<HTMLButtonElement>('[data-guide-load]')!;
  const reset = () => {
    form.reset(); form.querySelectorAll('[data-rows]').forEach((rows) => rows.replaceChildren());
    delete form.dataset.guideId; delete form.dataset.sourceHash;
    form.dataset.uploadId = crypto.randomUUID();
    const slug = form.elements.namedItem('slug') as HTMLInputElement; slug.readOnly = false;
    (form.elements.namedItem('draft') as HTMLInputElement).checked = true;
    (form.elements.namedItem('updatedDate') as HTMLInputElement).value = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    form.querySelector('[data-guide-save-label]')!.textContent = 'Save to Local Content';
    form.querySelector('[data-save-result]')!.replaceChildren();
  };
  root.querySelector('[data-guide-new]')?.addEventListener('click', () => {
    reset(); select.value = ''; status.textContent = 'New guide. Start with its title and save as a draft to review the complete page.';
    (form.elements.namedItem('body') as HTMLTextAreaElement).dispatchEvent(new Event('input', { bubbles: true }));
    (form.elements.namedItem('title') as HTMLInputElement).focus();
  });
  load.addEventListener('click', async () => {
    if (!select.value) { status.textContent = 'Choose a saved guide first.'; return; }
    load.disabled = true; status.textContent = 'Loading your saved guide…';
    try {
      const response = await fetch('/__studio/load-guide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: select.value }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      reset();
      form.querySelectorAll<Field>('[name]').forEach((field) => {
        const value = field.name === 'body' ? result.body : field.name === 'slug' ? result.id : result.data[field.name];
        if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = value === true;
        else field.value = Array.isArray(value) ? value.join(', ') : field instanceof HTMLInputElement && field.type === 'date' && value ? String(value).slice(0, 10) : value == null ? '' : String(value);
      });
      (form.elements.namedItem('adult') as HTMLInputElement).checked = result.data.adult === true || hasAdultMedia(result.data);
      form.querySelectorAll<HTMLElement>('[data-repeater]').forEach((group) => {
        for (const item of result.data[group.dataset.repeater!] ?? []) {
          group.querySelector<HTMLButtonElement>('[data-add-row]')!.click();
          const row = group.querySelector<HTMLElement>('[data-rows]')!.lastElementChild!;
          row.querySelectorAll<Field>('[data-key]').forEach((field) => {
            const value = group.dataset.values === 'list' ? item : item[field.dataset.key!];
            if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = value === true;
            else if (value !== undefined) field.value = String(value);
          });
        }
      });
      form.dataset.guideId = result.id; form.dataset.sourceHash = result.sha256;
      (form.elements.namedItem('slug') as HTMLInputElement).readOnly = true;
      form.querySelector('[data-guide-save-label]')!.textContent = 'Save guide changes';
      (form.elements.namedItem('body') as HTMLTextAreaElement).dispatchEvent(new Event('input', { bubbles: true }));
      status.textContent = 'Guide loaded. Add, remove or edit the information below. Saving keeps a previous source snapshot. ';
      const preview = document.createElement('a'); preview.href = result.previewUrl; preview.textContent = 'Preview saved guide →'; status.append(preview);
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'The guide could not be loaded.'; }
    finally { load.disabled = false; }
  });
}
