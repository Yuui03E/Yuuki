import { marked } from 'marked';
import DOMPurify from 'dompurify';

type Media = { id: number; type: string; title: { english?: string; romaji?: string; native?: string }; format?: string; season?: string; seasonYear?: number; startDate?: { year?: number }; episodes?: number; chapters?: number; status?: string; studios?: { nodes: { name: string }[] }; genres?: string[]; tags?: { name: string; isMediaSpoiler?: boolean }[]; coverImage: { extraLarge: string }; bannerImage?: string; description?: string };
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function initStudio() {
  const root = document.querySelector<HTMLElement>('[data-studio]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-studio-tab]'));
  const selectTab = (tab: HTMLButtonElement) => {
    tabs.forEach((item) => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; });
    root.querySelectorAll<HTMLElement>('[data-studio-panel]').forEach((panel) => { panel.hidden = panel.dataset.studioPanel !== tab.dataset.studioTab; });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[next]); tabs[next].focus();
    });
  });
  const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  root.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => { input.value ||= today; });
  root.querySelectorAll<HTMLElement>('[data-repeater]').forEach((group) => {
    group.querySelector('[data-add-row]')?.addEventListener('click', () => {
      const row = group.querySelector<HTMLTemplateElement>('template')!.content.cloneNode(true) as DocumentFragment;
      row.querySelector('[data-remove-row]')?.addEventListener('click', (event) => (event.currentTarget as HTMLElement).closest('.repeat-row')?.remove());
      row.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => { input.value ||= today; });
      const first = row.querySelector<HTMLInputElement>('input'); group.querySelector('[data-rows]')!.append(row); first?.focus();
    });
  });
  const editor = root.querySelector<HTMLTextAreaElement>('[data-guide-editor]')!;
  const preview = root.querySelector<HTMLElement>('[data-guide-preview]')!;
  let previewTimer: ReturnType<typeof setTimeout>;
  editor.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { preview.innerHTML = DOMPurify.sanitize(marked.parse(editor.value || '*Your guide preview will appear here.*', { async: false }), { USE_PROFILES: { html: true } }); }, 120);
  });
  const animeForm = root.querySelector<HTMLFormElement>('[data-studio-form="anime"]')!;
  const query = root.querySelector<HTMLInputElement>('[data-anilist-query]')!;
  const mediaType = root.querySelector<HTMLSelectElement>('[data-anilist-type]')!;
  const searchButton = root.querySelector<HTMLButtonElement>('[data-anilist-search]')!;
  const status = root.querySelector<HTMLElement>('[data-anilist-status]')!;
  const results = root.querySelector<HTMLElement>('[data-anilist-results]')!;
  const setField = (name: string, value: unknown) => { const field = animeForm.elements.namedItem(name) as Field | null; if (field) field.value = value == null ? '' : String(value); };
  const fill = (media: Media) => {
    const plain = new DOMParser().parseFromString(media.description ?? '', 'text/html');
    plain.querySelectorAll('br').forEach((br) => br.replaceWith('\n')); plain.querySelectorAll('script,style').forEach((element) => element.remove());
    const values: Record<string, unknown> = {
      title: media.title.english || media.title.romaji || media.title.native, romajiTitle: media.title.romaji, japaneseTitle: media.title.native,
      mediaType: media.type, anilistId: media.id, format: media.format, season: media.season, year: media.seasonYear || media.startDate?.year,
      totalEpisodes: media.type === 'MANGA' ? media.chapters : media.episodes,
      status: media.status === 'FINISHED' ? 'Completed' : media.status === 'RELEASING' ? 'Ongoing' : media.status === 'HIATUS' ? 'Paused' : 'Planned',
      sourceType: media.type === 'MANGA' ? 'Digital' : 'BD', studios: media.studios?.nodes.map((studio) => studio.name).join(', '),
      tags: [...new Set([...(media.genres ?? []), ...(media.tags ?? []).filter((tag) => !tag.isMediaSpoiler).map((tag) => tag.name)])].slice(0, 60).join(', '),
      coverImage: media.coverImage.extraLarge, bannerImage: media.bannerImage, synopsis: plain.body.textContent?.trim(),
    };
    Object.entries(values).forEach(([name, value]) => setField(name, value));
    status.textContent = `Imported ${values.title}. Review the archive status and source before saving.`;
  };
  const searchAniList = async () => {
    const raw = query.value.trim(); if (!raw) { status.textContent = 'Enter a title, AniList URL, or ID.'; return; }
    const urlMatch = /^https?:\/\/(?:www\.)?anilist\.co\/(anime|manga)\/(\d+)(?:[/?#]|$)/i.exec(raw);
    const id = /^\d+$/.test(raw) ? Number(raw) : urlMatch ? Number(urlMatch[2]) : undefined;
    if (urlMatch) mediaType.value = urlMatch[1].toUpperCase();
    const selection = 'id type title { english romaji native } format season seasonYear startDate { year } episodes chapters status studios(isMain: true) { nodes { name } } genres tags { name isMediaSpoiler } coverImage { extraLarge } bannerImage description(asHtml: false)';
    searchButton.disabled = true; status.textContent = 'Searching AniList…'; results.replaceChildren();
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ query: id ? `query ($id: Int, $type: MediaType) { Media(id: $id, type: $type) { ${selection} } }` : `query ($search: String, $type: MediaType) { Page(perPage: 6) { media(search: $search, type: $type) { ${selection} } } }`, variables: id ? { id, type: mediaType.value } : { search: raw, type: mediaType.value } }) });
      const payload = await response.json();
      if (!response.ok || payload.errors) throw new Error(response.status === 429 ? 'AniList is rate-limiting requests. Try again shortly.' : payload.errors?.[0]?.message || 'AniList could not be reached.');
      const media: Media[] = id ? payload.data.Media ? [payload.data.Media] : [] : payload.data.Page.media;
      status.textContent = media.length ? `${media.length} matches. Select one to fill the form.` : 'No matches. Try another title or use manual entry.';
      media.forEach((item) => {
        const button = document.createElement('button'); button.type = 'button';
        const image = document.createElement('img'); image.src = item.coverImage.extraLarge; image.alt = ''; image.loading = 'lazy';
        const text = document.createElement('span'); const title = document.createElement('strong'); title.textContent = item.title.english || item.title.romaji || item.title.native || `AniList ${item.id}`;
        const meta = document.createElement('small'); meta.textContent = [item.format, item.seasonYear || item.startDate?.year, `#${item.id}`].filter(Boolean).join(' · ');
        text.append(title, meta); button.append(image, text); button.addEventListener('click', () => fill(item)); results.append(button);
      });
    } catch (error) { status.textContent = `${error instanceof Error ? error.message : 'Search failed.'} Manual entry is available below.`; }
    finally { clearTimeout(timeout); searchButton.disabled = false; }
  };
  searchButton.addEventListener('click', () => void searchAniList());
  query.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); void searchAniList(); } });
  root.querySelectorAll<HTMLFormElement>('[data-studio-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const kind = form.dataset.studioForm!;
      const output = form.querySelector<HTMLElement>('[data-save-result]')!;
      const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
      form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
      const data: Record<string, unknown> = {};
      const envelope: Record<string, unknown> = {};
      const lists = new Set(['tags', 'studios', 'os']);
      form.querySelectorAll<Field>('[name]').forEach((field) => {
        const value = field.value.trim();
        if (field.name === 'body' || field.name === 'slug') { if (value) envelope[field.name] = value; return; }
        if (field instanceof HTMLInputElement && field.type === 'checkbox') { data[field.name] = field.checked; return; }
        if (!value) return;
        data[field.name] = lists.has(field.name) ? value.split(',').map((part) => part.trim()).filter(Boolean) : field instanceof HTMLInputElement && field.type === 'number' ? Number(value) : value;
      });
      form.querySelectorAll<HTMLElement>('[data-repeater]').forEach((group) => {
        const rows = Array.from(group.querySelectorAll<HTMLElement>('[data-rows] .repeat-row')).map((row) => {
          const values: Record<string, unknown> = {};
          row.querySelectorAll<HTMLInputElement>('[data-key]').forEach((field) => { if (field.type === 'checkbox') { if (field.checked) values[field.dataset.key!] = true; } else if (field.value.trim()) values[field.dataset.key!] = field.type === 'number' ? Number(field.value) : field.value.trim(); });
          return values;
        }).filter((row) => Object.keys(row).length);
        if (rows.length) data[group.dataset.repeater!] = rows;
      });
      submit.disabled = true; output.dataset.error = 'false'; output.textContent = 'Validating and saving local content…';
      try {
        const response = await fetch(`/__studio/save-${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...envelope, data }) });
        const result = await response.json();
        if (!response.ok) {
          for (const issue of result.fields ?? []) { const name = issue.path.replace(/^data\./, ''); (form.elements.namedItem(name) as Field | null)?.setAttribute('aria-invalid', 'true'); }
          throw new Error([result.error, ...(result.fields ?? []).map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`)].join(' '));
        }
        output.textContent = `Saved ${result.file}${result.draft ? ' as a draft.' : result.hiddenByParent ? '. Hidden from public pages because its series is a draft.' : '.'}`;
        if (result.url) { const link = document.createElement('a'); link.href = result.url; link.textContent = 'View entry →'; output.append(link); }
        if (kind === 'anime') { const select = root.querySelector<HTMLSelectElement>('select[name="anime"]')!; if (!Array.from(select.options).some((option) => option.value === result.id)) select.add(new Option(`${data.title}${result.draft ? ' · draft' : ''}`, result.id)); }
      } catch (error) { output.dataset.error = 'true'; output.textContent = error instanceof Error ? error.message : 'The content could not be saved.'; }
      finally { submit.disabled = false; }
    });
  });
}
