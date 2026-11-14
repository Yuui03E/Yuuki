import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdult, assertAdultBody, deferMediaHtml } from '../src/lib/audience.mjs';
test('adult classification inherits and detects nested R2 adult fields', () => {
  assert.equal(isAdult({}, { adult: true }), true);
  assert.equal(isAdult({ screenshots: [{ src: 'https://media.example/media/adult/abc.webp' }] }), true);
  assert.equal(isAdult({ adult: false }), false);
});
test('adult notes allow text and code but reject media, imports, HTML and MDX expressions', () => {
  assert.doesNotThrow(() => assertAdultBody('## Notes\n\n~~~js\nconst x = { html: "<img src=x>" };\n~~~'));
  for (const body of ['![image](https://example.com/x)', '![image][ref]', '<img src="x">', 'import X from "x"', '{globalThis}', '<style>body{background:url(x)}</style>']) assert.throws(() => assertAdultBody(body));
});
test('media deferral removes network attributes and autoplay and is repeatable', () => {
  const input = '<img src="a" srcset="b 2x"><video autoplay preload="auto" src="v" poster="p"><source src="s"></video><object data="o"></object>';
  const html = deferMediaHtml(input); assert.doesNotMatch(html, /\s(?:src|srcset|poster|data)=|autoplay/); assert.match(html, /data-src="a"/); assert.equal(deferMediaHtml(html), html);
});
