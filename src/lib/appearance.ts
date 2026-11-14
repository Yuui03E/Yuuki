export interface AppearancePreferences {
  font: 'editorial' | 'modern' | 'bookish' | 'mono';
  textColor: string;
  background: 'plain' | 'contour' | 'orbit' | 'grid';
  backgroundShuffle: 'on' | 'off';
  backgroundChangedAt: number;
  backgroundStrength: number;
  grain: number;
  clock: '24h' | '12h' | 'off';
  slideshow: 'auto' | 'manual';
}

export type ColorTheme = 'dark' | 'light';
export const APPEARANCE_STORAGE_KEY = 'yuuki.appearance.v1';
export const THEME_STORAGE_KEY = 'yuuki-theme';

/** Self-contained so the same validation can run before the first paint. */
export function resolveAppearance(value: unknown, theme: ColorTheme = 'dark') {
  const defaults: AppearancePreferences = {
    font: 'editorial', textColor: 'default', background: 'contour', backgroundShuffle: 'on', backgroundChangedAt: 0,
    backgroundStrength: 28, grain: 0, clock: '24h', slideshow: 'auto',
  };
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const choice = <T extends string>(input: unknown, options: readonly T[], fallback: T): T =>
    typeof input === 'string' && options.includes(input as T) ? input as T : fallback;
  const percentage = (input: unknown, fallback: number) =>
    typeof input === 'number' && Number.isFinite(input) ? Math.round(Math.max(0, Math.min(100, input))) : fallback;
  const preferences: AppearancePreferences = {
    font: choice(raw.font, ['editorial', 'modern', 'bookish', 'mono'], defaults.font),
    textColor: typeof raw.textColor === 'string' && /^#[\da-f]{6}$/i.test(raw.textColor) ? raw.textColor.toLowerCase() : 'default',
    background: choice(raw.background, ['plain', 'contour', 'orbit', 'grid'], defaults.background),
    backgroundShuffle: choice(raw.backgroundShuffle, ['on', 'off'], raw.background === 'plain' ? 'off' : defaults.backgroundShuffle),
    backgroundChangedAt: typeof raw.backgroundChangedAt === 'number' && Number.isSafeInteger(raw.backgroundChangedAt) && raw.backgroundChangedAt > 0 ? raw.backgroundChangedAt : 0,
    backgroundStrength: percentage(raw.backgroundStrength, defaults.backgroundStrength),
    grain: percentage(raw.grain, defaults.grain),
    clock: choice(raw.clock, ['24h', '12h', 'off'], defaults.clock),
    slideshow: choice(raw.slideshow, ['auto', 'manual'], defaults.slideshow),
  };

  const channels = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const mix = (color: string, target: string, amount: number) => {
    const start = channels(color); const end = channels(target);
    return `#${start.map((channel, index) => Math.round(channel + (end[index]! - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
  };
  const luminance = (hex: string) => {
    const rgb = channels(hex).map((channel) => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
  };
  const backgrounds = theme === 'light' ? ['#f3f2e9', '#fafaf4', '#e9eddf'] : ['#000000', '#090b08', '#141711'];
  const target = theme === 'light' ? '#20271b' : '#f0f1e9';
  const contrast = (color: string) => Math.min(...backgrounds.map((background) => {
    const front = luminance(color); const back = luminance(background);
    return (Math.max(front, back) + .05) / (Math.min(front, back) + .05);
  }));
  const readable = (color: string, minimum: number) => {
    if (contrast(color) >= minimum) return color;
    let low = 0; let high = 1;
    for (let index = 0; index < 14; index++) {
      const middle = (low + high) / 2;
      if (contrast(mix(color, target, middle)) >= minimum) high = middle; else low = middle;
    }
    return mix(color, target, high);
  };
  const text = preferences.textColor === 'default' ? undefined : readable(preferences.textColor, 7);
  const colors = text ? {
    text, muted: readable(mix(text, backgrounds[0]!, .2), 4.5),
    subtle: readable(mix(text, backgrounds[0]!, .32), 4.5),
    adjusted: text !== preferences.textColor,
  } : null;
  const attributes: Record<string, string> = {
    'data-theme': theme, 'data-font': preferences.font, 'data-text-color': preferences.textColor,
    'data-background': preferences.background, 'data-background-shuffle': preferences.backgroundShuffle, 'data-grain': String(preferences.grain),
    'data-clock': preferences.clock, 'data-slideshow': preferences.slideshow,
  };
  const variables: Record<string, string> = {
    '--text': colors?.text ?? '', '--muted': colors?.muted ?? '', '--subtle': colors?.subtle ?? '',
    '--grain-opacity': String(preferences.grain / 100 * (theme === 'light' ? .36 : .52)),
    '--backdrop-opacity': String(preferences.backgroundStrength / 100 * (theme === 'light' ? .24 : .32)),
  };
  return { preferences, colors, attributes, variables };
}

export const DEFAULT_APPEARANCE = resolveAppearance({}).preferences;
export const BACKGROUND_SHUFFLE_INTERVAL = 5 * 60_000;

export function nextBackground(current: AppearancePreferences['background'], random = Math.random): AppearancePreferences['background'] {
  const designs = (['contour', 'orbit', 'grid'] as const).filter((design) => design !== current);
  return designs[Math.min(designs.length - 1, Math.max(0, Math.floor(random() * designs.length)))]!;
}

// Keep the bootstrap small and identical to the deferred control logic. No stored
// text is inserted into HTML or CSS before it passes resolveAppearance().
export const appearanceBootstrap = `(() => {
  const resolve = ${resolveAppearance.toString()};
  const read = (key) => {
    try { const value = sessionStorage.getItem(key); if (value !== null) return value; } catch {}
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const theme = read(${JSON.stringify(THEME_STORAGE_KEY)}) === 'light' ? 'light' : 'dark';
  let saved; try { saved = JSON.parse(read(${JSON.stringify(APPEARANCE_STORAGE_KEY)}) ?? 'null'); } catch {}
  const state = resolve(saved, theme); const root = document.documentElement;
  for (const [key, value] of Object.entries(state.attributes)) root.setAttribute(key, value);
  for (const [key, value] of Object.entries(state.variables)) { if (value) root.style.setProperty(key, value); else root.style.removeProperty(key); }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f2e9' : '#000000');
})();`;

export function formatLocalClock(date: Date, mode: AppearancePreferences['clock'], locale?: string) {
  if (mode === 'off') return null;
  const formatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: mode === '12h' ? 'h12' : 'h23' });
  return { time: formatter.format(date) };
}
