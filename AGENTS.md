# Yuuki architectural rules

- Use Astro 7+ with strict TypeScript and `output: 'static'`.
- Do not add React, Vue, Svelte, Tailwind CSS, SSR, or server adapters such as `@astrojs/cloudflare` or `@astrojs/node`.
- Keep public pages fast and nearly zero JavaScript. Load optional interactions only on pages that use them. Chart.js must be imported only inside `src/components/MetricChart.astro`.
- Use vanilla CSS, reusable tokens in `src/styles/tokens.css`, and scoped component styles. Default to pitch-black OLED surfaces and compact, accessible, responsive layouts.
- Define all five content collections in `src/content.config.ts`, using `glob()` from `astro/loaders` and `z` from `astro/zod`. Use `entry.id`, never `entry.slug`, and use `render(entry)` from `astro:content`.
- Every episode technical field must be optional in its Zod input schema. Render technical fields only when present; never render empty rows or `N/A`.
- Use MD/MDX content and local SVG sample assets. Never commit original media, archives, secrets, dependencies, or build output. Preserve TypeScript source exceptions in `.gitignore`.
- The publishing studio and its write endpoints are development-only, bound to loopback. Verify request origin and host, validate all fields, keep writes within approved collection folders, and never silently overwrite an existing file.
- Exclude drafts and any episodes referencing a draft series from all public pages and search indexes. Do not ship the studio UI, studio JavaScript, or publishing endpoints in production.
- Run `npx astro check && npm run build` before completing every task, and fix errors and warnings. Run meaningful interaction and studio validation checks when modifying those features.
- Do not push to GitHub unless the user requests it.
