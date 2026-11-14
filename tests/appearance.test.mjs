import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { resolveAppearance, DEFAULT_APPEARANCE, appearanceBootstrap, formatLocalClock, nextBackground } from '../src/lib/appearance.ts';

test('appearance preferences validate stored values and clamp finite percentages', () => {
  for (const value of [null, undefined, [], 'bad', 42]) assert.deepEqual(resolveAppearance(value).preferences, DEFAULT_APPEARANCE);
  const invalid = resolveAppearance({ font: 'Comic Sans', textColor: 'red;display:none', background: '../../file', grain: 200, backgroundStrength: -1, clock: 'now', slideshow: 'fast' });
  assert.deepEqual(invalid.preferences, { ...DEFAULT_APPEARANCE, grain: 100, backgroundStrength: 0 });
  for (const value of [NaN, Infinity, -Infinity, '75']) assert.equal(resolveAppearance({ grain: value }).preferences.grain, 0);
  assert.equal(resolveAppearance({ grain: 32.6 }).preferences.grain, 33);
  assert.equal(resolveAppearance({ textColor: '#BCE2D3' }).preferences.textColor, '#bce2d3');
  assert.equal(resolveAppearance({ textColor: '#fff' }).preferences.textColor, 'default');
  assert.doesNotMatch(JSON.stringify(invalid.attributes) + JSON.stringify(invalid.variables), /display:none|Comic Sans|\.\.\//);
});

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const rgb = hex.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('custom text colors remain readable on every shared surface in either theme', () => {
  for (const theme of ['dark', 'light']) {
    const backgrounds = theme === 'light' ? ['#f3f2e9', '#fafaf4', '#e9eddf'] : ['#000000', '#090b08', '#141711'];
    for (const textColor of ['#000000', '#ffffff', '#333333', '#aaaaaa', '#ff0000', '#0000ff', '#eacba2', '#bce2d3', '#bdcbf4']) {
      const result = resolveAppearance({ textColor }, theme);
      assert.equal(result.preferences.textColor, textColor, 'Keep the requested shade so theme switching can reinterpret it.');
      for (const background of backgrounds) {
        assert.ok(contrastRatio(result.colors.text, background) >= 7, `${theme} primary text: ${textColor}`);
        assert.ok(contrastRatio(result.colors.muted, background) >= 4.5, `${theme} secondary text: ${textColor}`);
        assert.ok(contrastRatio(result.colors.subtle, background) >= 4.5, `${theme} small text: ${textColor}`);
      }
    }
  }
  assert.equal(resolveAppearance({ textColor: 'default' }).colors, null);
});

function runBootstrap(values = {}, unavailable = []) {
  const attributes = {}; const styles = {};
  const storage = (name) => ({ getItem(key) { if (unavailable.includes(name)) throw new Error('Blocked'); return values[name]?.[key] ?? null; } });
  vm.runInNewContext(appearanceBootstrap, {
    localStorage: storage('local'), sessionStorage: storage('session'),
    document: { documentElement: { setAttribute(key, value) { attributes[key] = value; }, style: { setProperty(key, value) { styles[key] = value; }, removeProperty(key) { delete styles[key]; } } }, querySelector() { return null; } },
  });
  return { attributes, styles };
}

test('first-paint bootstrap shares validation and tolerates blocked or malformed storage', () => {
  const prefs = { font: 'mono', textColor: '#000000', grain: 55, background: 'orbit' };
  const values = { local: { 'yuuki-theme': 'light', 'yuuki.appearance.v1': JSON.stringify(prefs) } };
  const early = runBootstrap(values); const state = resolveAppearance(prefs, 'light');
  assert.deepEqual(early.attributes, state.attributes);
  assert.deepEqual(early.styles, state.variables);
  assert.equal(runBootstrap({ local: { 'yuuki.appearance.v1': 'broken {' } }).attributes['data-font'], 'editorial');
  assert.equal(runBootstrap({}, ['local', 'session']).attributes['data-theme'], 'dark');
  const fallback = runBootstrap({ ...values, session: { 'yuuki.appearance.v1': JSON.stringify({ font: 'bookish' }) } });
  assert.equal(fallback.attributes['data-font'], 'bookish');
});

test('clock returns only the device time, an explicit hour format, and an off setting', () => {
  const date = new Date('2026-11-14T00:07:00Z');
  const twentyFour = formatLocalClock(date, '24h', 'en-US');
  assert.match(twentyFour.time, /^\d{2}:\d{2}$/);
  assert.deepEqual(Object.keys(twentyFour), ['time']);
  assert.match(formatLocalClock(date, '12h', 'en-US').time, /\d{2}:\d{2}\s*[AP]M$/);
  assert.equal(formatLocalClock(date, 'off'), null);
});

test('background shuffle validates settings and keeps older Plain choices fixed', () => {
  assert.equal(resolveAppearance({}).preferences.backgroundShuffle, 'on');
  assert.equal(resolveAppearance({ background: 'plain' }).preferences.backgroundShuffle, 'off');
  assert.equal(resolveAppearance({ background: 'plain', backgroundShuffle: 'on' }).preferences.backgroundShuffle, 'on');
  assert.equal(resolveAppearance({ backgroundShuffle: 'bad' }).preferences.backgroundShuffle, 'on');
  for (const invalid of [-1, Infinity, 'today', 1.5]) assert.equal(resolveAppearance({ backgroundChangedAt: invalid }).preferences.backgroundChangedAt, 0);
  for (const current of ['plain', 'contour', 'orbit', 'grid']) {
    for (const random of [0, .25, .75, 1]) {
      const next = nextBackground(current, () => random);
      assert.notEqual(next, current);
      assert.ok(['contour', 'orbit', 'grid'].includes(next));
    }
  }
});
