import {
  APPEARANCE_STORAGE_KEY, THEME_STORAGE_KEY, DEFAULT_APPEARANCE,
  resolveAppearance, formatLocalClock, nextBackground, BACKGROUND_SHUFFLE_INTERVAL, type AppearancePreferences, type ColorTheme,
} from '../lib/appearance';

type Persistence = 'browser' | 'session' | 'page';
function readSaved(key: string): { value: string | null; persistence: Persistence } {
  let sessionAvailable = false;
  try {
    const value = sessionStorage.getItem(key); sessionAvailable = true;
    if (value !== null) return { value, persistence: 'session' };
  } catch {}
  try { return { value: localStorage.getItem(key), persistence: 'browser' }; }
  catch { return { value: null, persistence: sessionAvailable ? 'session' : 'page' }; }
}
function parseSaved(value: string | null): unknown {
  try { return JSON.parse(value ?? 'null'); } catch { return null; }
}
function save(key: string, value: string): Persistence {
  try {
    localStorage.setItem(key, value);
    try { sessionStorage.removeItem(key); } catch {}
    return 'browser';
  } catch {
    try { sessionStorage.setItem(key, value); return 'session'; } catch { return 'page'; }
  }
}

const saved = readSaved(APPEARANCE_STORAGE_KEY);
const savedTheme = readSaved(THEME_STORAGE_KEY);
let appearancePersistence = saved.persistence;
let themePersistence = savedTheme.persistence;
let theme: ColorTheme = savedTheme.value === 'light' ? 'light' : 'dark';
let preferences = resolveAppearance(parseSaved(saved.value), theme).preferences;
const root = document.documentElement;
const panel = document.querySelector<HTMLElement>('[data-appearance]');
const form = panel?.querySelector<HTMLFormElement>('[data-appearance-form]');
const clock = document.querySelector<HTMLElement>('[data-local-clock]');
let clockTimer: number | undefined;
let clockVisible = !('IntersectionObserver' in window);
let backgroundTimer: number | undefined;

export function getAppearance(): AppearancePreferences { return { ...preferences }; }

export function setAppearance(update: Partial<AppearancePreferences>) {
  const next = { ...preferences, ...update };
  if ((update.background && update.background !== preferences.background) || (update.backgroundShuffle === 'on' && preferences.backgroundShuffle !== 'on')) next.backgroundChangedAt = Date.now();
  if (update.background === 'plain' && update.backgroundShuffle === undefined) next.backgroundShuffle = 'off';
  preferences = resolveAppearance(next, theme).preferences;
  appearancePersistence = save(APPEARANCE_STORAGE_KEY, JSON.stringify(preferences));
  apply();
}

function setTheme(next: ColorTheme) {
  theme = next;
  themePersistence = save(THEME_STORAGE_KEY, theme);
  apply();
}

function updateClock(force = false) {
  window.clearTimeout(clockTimer); clockTimer = undefined;
  if (!clock) return;
  clock.hidden = preferences.clock === 'off';
  if (clock.hidden || document.hidden) return;
  const bounds = clock.getBoundingClientRect();
  const visible = clockVisible && bounds.bottom > 0 && bounds.top < innerHeight;
  if (!visible && !force) return;
  try {
    const now = new Date();
    const value = formatLocalClock(now, preferences.clock, navigator.language);
    clock.hidden = !value;
    if (value) {
      const time = clock.querySelector<HTMLTimeElement>('time');
      if (time) { time.textContent = value.time; time.dateTime = now.toISOString(); }
      clock.setAttribute('aria-label', `Current time: ${value.time}`);
      if (visible) clockTimer = window.setTimeout(updateClock, 60_000 - Date.now() % 60_000 + 20);
    }
  } catch { clock.hidden = true; }
}

function scheduleBackground() {
  window.clearTimeout(backgroundTimer); backgroundTimer = undefined;
  if (preferences.backgroundShuffle !== 'on' || document.hidden) return;
  const delay = Math.max(0, preferences.backgroundChangedAt + BACKGROUND_SHUFFLE_INTERVAL - Date.now());
  backgroundTimer = window.setTimeout(() => {
    if (document.hidden || preferences.backgroundShuffle !== 'on') return;
    // Another visible tab may have already advanced the shared background.
    const stored = parseSaved(readSaved(APPEARANCE_STORAGE_KEY).value);
    if (appearancePersistence !== 'page' && stored && typeof stored === 'object' && !Array.isArray(stored)) preferences = resolveAppearance(stored, theme).preferences;
    if (preferences.backgroundShuffle !== 'on' || Date.now() < preferences.backgroundChangedAt + BACKGROUND_SHUFFLE_INTERVAL) { apply(); return; }
    setAppearance({ background: nextBackground(preferences.background) });
  }, delay);
}

function syncControls(state: ReturnType<typeof resolveAppearance>) {
  if (!form) return;
  form.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => {
    const value = input.name === 'theme' ? theme : preferences[input.name as keyof AppearancePreferences];
    input.checked = input.value === value;
  });
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[type="range"], select').forEach((input) => {
    input.value = String(preferences[input.name as keyof AppearancePreferences]);
  });
  const color = form.querySelector<HTMLInputElement>('[name="customColor"]');
  const defaultText = theme === 'light' ? '#20271b' : '#f0f1e9';
  if (color) color.value = preferences.textColor === 'default' ? defaultText : preferences.textColor;
  const effective = form.querySelector<HTMLOutputElement>('[data-effective-color]');
  if (effective) effective.textContent = state.colors?.text ?? defaultText;
  const colorNote = form.querySelector<HTMLElement>('[data-color-note]');
  if (colorNote) colorNote.hidden = !state.colors?.adjusted;
  const design = form.querySelector<HTMLInputElement>('[name="backgroundStrength"]');
  if (design) design.disabled = preferences.background === 'plain';
  const designOutput = form.querySelector<HTMLOutputElement>('[data-background-output]');
  if (designOutput) designOutput.textContent = preferences.background === 'plain' ? 'Off' : `${preferences.backgroundStrength}%`;
  const grainOutput = form.querySelector<HTMLOutputElement>('[data-grain-output]');
  if (grainOutput) grainOutput.textContent = preferences.grain ? `${preferences.grain}%` : 'Off';
  const status = form.querySelector<HTMLElement>('[data-appearance-status]');
  const modes = [appearancePersistence, themePersistence];
  const persistence: Persistence = modes.includes('page') ? 'page' : modes.includes('session') ? 'session' : 'browser';
  if (status) status.textContent = persistence === 'browser' ? 'Saved in this browser.'
    : persistence === 'session' ? 'Saved for this tab. Your browser could not save these for later.'
    : 'Applied to this page. Your browser could not save these choices.';
}

function apply() {
  if (preferences.backgroundShuffle === 'on' && (!preferences.backgroundChangedAt || preferences.backgroundChangedAt > Date.now())) {
    preferences.backgroundChangedAt = Date.now();
    appearancePersistence = save(APPEARANCE_STORAGE_KEY, JSON.stringify(preferences));
  }
  const state = resolveAppearance(preferences, theme);
  for (const [key, value] of Object.entries(state.attributes)) root.setAttribute(key, value);
  for (const [key, value] of Object.entries(state.variables)) {
    if (value) root.style.setProperty(key, value); else root.style.removeProperty(key);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f2e9' : '#000000');
  document.querySelector('[data-theme-toggle]')?.setAttribute('aria-pressed', String(theme === 'light'));
  syncControls(state); updateClock(true); scheduleBackground();
  document.dispatchEvent(new CustomEvent('yuuki:appearance-change', { detail: { preferences: getAppearance(), theme } }));
}

form?.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
  if (input.name === 'theme') { setTheme(input.value === 'light' ? 'light' : 'dark'); return; }
  if (input.name === 'customColor') { setAppearance({ textColor: input.value }); return; }
  if (!Object.hasOwn(DEFAULT_APPEARANCE, input.name)) return;
  const value = input.type === 'range' ? Number(input.value) : input.value;
  setAppearance({ [input.name]: value });
});
form?.addEventListener('reset', (event) => {
  event.preventDefault(); preferences = { ...DEFAULT_APPEARANCE }; theme = 'dark';
  themePersistence = save(THEME_STORAGE_KEY, theme); appearancePersistence = save(APPEARANCE_STORAGE_KEY, JSON.stringify(preferences)); apply();
});
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTheme(theme === 'light' ? 'dark' : 'light'));

window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== APPEARANCE_STORAGE_KEY && event.key !== THEME_STORAGE_KEY) return;
  // A change in another tab supersedes a temporary session fallback.
  try {
    if (event.key !== THEME_STORAGE_KEY) sessionStorage.removeItem(APPEARANCE_STORAGE_KEY);
    if (event.key !== APPEARANCE_STORAGE_KEY) sessionStorage.removeItem(THEME_STORAGE_KEY);
  } catch {}
  if (event.key !== THEME_STORAGE_KEY) { preferences = resolveAppearance(parseSaved(event.newValue), theme).preferences; appearancePersistence = 'browser'; }
  if (event.key !== APPEARANCE_STORAGE_KEY) { theme = event.newValue === 'light' ? 'light' : 'dark'; themePersistence = 'browser'; }
  apply();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const current = readSaved(APPEARANCE_STORAGE_KEY); appearancePersistence = current.persistence;
  preferences = resolveAppearance(parseSaved(current.value), theme).preferences;
  const currentTheme = readSaved(THEME_STORAGE_KEY); themePersistence = currentTheme.persistence;
  theme = currentTheme.value === 'light' ? 'light' : 'dark'; apply();
});
document.addEventListener('visibilitychange', () => { updateClock(); scheduleBackground(); });
if (clock && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => { clockVisible = entry?.isIntersecting ?? false; updateClock(); }).observe(clock);
}
panel?.querySelector<HTMLFieldSetElement>('[data-appearance-fields]')?.removeAttribute('disabled');
apply();
panel?.setAttribute('data-ready', 'true');
