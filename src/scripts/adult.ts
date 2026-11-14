const consentKey = 'yuuki.adult-consent.v1';
let memoryConsent = false;
const hasConsent = () => {
  try { if (localStorage.getItem(consentKey) === 'confirmed') return true; } catch { /* Storage can be disabled. */ }
  try { if (sessionStorage.getItem(consentKey) === 'confirmed') return true; } catch { /* Use this page as a final fallback. */ }
  return memoryConsent;
};
const rememberConsent = () => {
  memoryConsent = true;
  try { localStorage.setItem(consentKey, 'confirmed'); return; } catch { /* Try tab storage. */ }
  try { sessionStorage.setItem(consentKey, 'confirmed'); } catch { /* Keep the choice for this page. */ }
};
const forgetConsent = () => {
  memoryConsent = false;
  try { localStorage.removeItem(consentKey); } catch { /* Storage can be disabled. */ }
  try { sessionStorage.removeItem(consentKey); } catch { /* Storage can be disabled. */ }
};

export function initAdultGates() {
  document.querySelectorAll<HTMLElement>('[data-adult-gate]').forEach((gate) => {
    if (gate.dataset.ready) return;
    gate.dataset.ready = 'true';
    const choice = gate.querySelector<HTMLElement>('[data-adult-choice]')!;
    const content = gate.querySelector<HTMLElement>('[data-adult-content]')!;
    const checkbox = gate.querySelector<HTMLInputElement>('[data-adult-confirm]')!;
    const button = gate.querySelector<HTMLButtonElement>('[data-adult-continue]')!;
    const media = Array.from(gate.querySelectorAll<HTMLElement>('[data-adult-media]'));
    checkbox.addEventListener('change', () => { button.disabled = !checkbox.checked; });
    const show = (focus = false) => {
      choice.hidden = true;
      content.hidden = false;
      // Sources are assigned before their parent media element, avoiding an initial request for the wrong file.
      [...media.filter((item) => item.tagName === 'SOURCE'), ...media.filter((item) => item.tagName !== 'SOURCE')].forEach((element) => {
        for (const attribute of ['srcset', 'poster', 'data', 'src']) {
          const value = element.getAttribute(`data-${attribute}`);
          if (value !== null) element.setAttribute(attribute, value);
        }
      });
      if (focus) {
        content.querySelector<HTMLElement>('h1, h2')?.setAttribute('tabindex', '-1');
        content.querySelector<HTMLElement>('h1, h2')?.focus();
      }
    };
    const hide = (focus = false) => {
      content.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
      content.querySelectorAll<HTMLMediaElement>('video, audio').forEach((element) => element.pause());
      media.forEach((element) => { for (const attribute of ['src', 'srcset', 'poster', 'data']) element.removeAttribute(attribute); });
      content.querySelectorAll<HTMLMediaElement>('video, audio').forEach((element) => element.load());
      content.hidden = true; choice.hidden = false; checkbox.checked = false; button.disabled = true;
      if (focus) checkbox.focus();
    };
    button.addEventListener('click', () => {
      if (!checkbox.checked) return;
      rememberConsent(); show(true);
    });
    gate.querySelector('[data-adult-leave]')?.addEventListener('click', () => {
      forgetConsent(); hide(true);
    });
    // A reset in another tab also unloads this tab's adult media.
    window.addEventListener('storage', (event) => {
      let storage: Storage;
      try { storage = localStorage; } catch { return; }
      if (event.storageArea === storage && (event.key === consentKey || event.key === null)) {
        memoryConsent = false;
        if (event.newValue === 'confirmed') show();
        else { forgetConsent(); hide(); }
      }
    });
    if (hasConsent()) show();
    const search = content.querySelector<HTMLInputElement>('[data-adult-search]');
    search?.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      content.querySelectorAll<HTMLElement>('[data-adult-item]').forEach((item) => { item.hidden = !(item.dataset.search ?? item.textContent ?? '').toLowerCase().includes(query); });
    });
  });
}
