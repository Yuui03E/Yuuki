import { slugify } from '../lib/media-paths.mjs';
type Input = HTMLInputElement;

export function initStudioMedia(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-media-status]')!;
  const refresh = async () => {
    try {
      const response = await fetch('/__studio/media-status', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      status.textContent = `${result.message} Local library: ${(result.storedBytes / 1e9).toFixed(2)} / ${(result.budgetBytes / 1e9).toFixed(2)} GB. This limit is not a Cloudflare billing cap.`;
    } catch { status.textContent = 'R2 status unavailable. Check the local server and docs/R2_SETUP.md.'; }
  };
  void refresh();
  const adultFor = (form: HTMLFormElement) => form.querySelector<Input>('[name="adult"]')?.checked || form.querySelector<HTMLSelectElement>('[name="anime"]')?.selectedOptions[0]?.dataset.adult === 'true';
  const install = () => {
    root.querySelectorAll<Input>('[name="coverImage"], [name="bannerImage"], [name="thumbnail"], [data-key="src"], [data-key="sourceImage"], [data-key="encodeImage"], [data-key="poster"]').forEach((field) => {
      if (field.dataset.r2Ready) return;
      field.dataset.r2Ready = 'true';
      const form = field.closest('form')!;
      form.dataset.uploadId ||= crypto.randomUUID();
      const video = field.dataset.key === 'src' && field.closest('[data-repeater]')?.getAttribute('data-repeater') === 'videos';
      const label = field.closest('label')!;
      const wrapper = document.createElement('div'); wrapper.style.minWidth = '0';
      label.replaceWith(wrapper); wrapper.append(label);
      const controls = document.createElement('div'); controls.className = 'media-upload';
      const choose = document.createElement('input'); choose.type = 'file'; choose.hidden = true;
      choose.accept = video ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp,image/gif';
      choose.setAttribute('aria-label', `Choose ${video ? 'video' : 'image'} for ${field.name || field.dataset.key}`);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button'; button.textContent = 'Upload to R2'; button.dataset.mediaUpload = 'true';
      const output = document.createElement('span'); output.className = 'media-upload-status'; output.setAttribute('role', 'status');
      controls.append(button, choose, output); wrapper.append(controls);
      button.addEventListener('click', () => choose.click());
      choose.addEventListener('change', async () => {
        const file = choose.files?.[0]; if (!file) return;
        const audience = adultFor(form) ? 'adult' : 'general';
        if (audience === 'adult') form.querySelector<Input>('[name="adult"]')!.checked = true;
        button.disabled = true; output.textContent = `Backing up and uploading ${audience} media…`;
        try {
          if (file.size > (video ? 25_000_000 : 10_000_000)) throw new Error(video ? 'Videos must be at most 25 MB.' : 'Images must be at most 10 MB.');
          const value = (name: string) => (form.elements.namedItem(name) as Input | HTMLSelectElement | null)?.value.trim() || '';
          const kind = form.dataset.studioForm!;
          const episode = kind === 'episode';
          if (episode && (!value('anime') || !value('episodeNumber'))) throw new Error('Select the series and enter the episode number before uploading.');
          if (!episode && !value('title')) throw new Error('Enter the post title before uploading.');
          const fallback = episode ? `${value('anime')}-${form.querySelector<Input>('[name="isBatch"]')?.checked ? 'batch-' : ''}${value('episodeNumber')}-${value('version') || 'v1'}` : value('title');
          const id = slugify(value('slug') || fallback);
          if (!id) throw new Error('Enter a Content ID using letters or numbers before uploading.');
          const slug = form.elements.namedItem('slug') as Input;
          slug.value = id;
          // Reserve one identity for all uploads in this form, even if its title changes.
          slug.readOnly = true;
          const title = episode ? `${form.querySelector<HTMLSelectElement>('[name="anime"]')!.selectedOptions[0]!.textContent} · ${value('episodeNumber')} · ${value('version') || 'v1'}${value('title') ? ` · ${value('title')}` : ''}` : value('title');
          const post = { collection: episode ? 'episodes' : kind === 'guide' ? 'guides' : 'anime', id, title: title.slice(0, 300), uploadId: form.dataset.uploadId, ...(form.dataset.sourceHash ? { sourceHash: form.dataset.sourceHash } : {}) };
          const payload = new FormData(); payload.set('file', file); payload.set('audience', audience); payload.set('post', JSON.stringify(post));
          const response = await fetch('/__studio/media-upload', { method: 'POST', body: payload });
          const result = await response.json(); if (!response.ok) { if (response.status === 409) slug.readOnly = false; throw new Error(result.error); }
          if (!String(result.contentType).startsWith(video ? 'video/' : 'image/')) throw new Error('File uploaded and backed up, but it is the wrong type for this field.');
          field.value = result.url; field.dispatchEvent(new Event('input', { bubbles: true }));
          output.textContent = `Uploaded to ${post.collection}/${id}, original backed up, and online bytes verified.${result.onlineCatalogBackedUp === false ? ' Online catalog backup failed; retry this file to repair it.' : ''}`;
          await refresh();
        } catch (error) { output.textContent = error instanceof Error ? error.message : 'Upload failed.'; }
        finally { button.disabled = false; choose.value = ''; }
      });
    });
  };
  install(); new MutationObserver(install).observe(root, { childList: true, subtree: true });
  const episode = root.querySelector<HTMLFormElement>('[data-studio-form="episode"]')!;
  episode.querySelector('[name="anime"]')?.addEventListener('change', () => {
    if (adultFor(episode)) episode.querySelector<Input>('[name="adult"]')!.checked = true;
  });
}
