import { getAppearance, setAppearance } from './appearance';

document.querySelectorAll<HTMLElement>('[data-release-spotlight]').forEach((root) => {
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-spotlight-slide]'));
  const controls = root.querySelector<HTMLElement>('[data-spotlight-controls]');
  const play = controls?.querySelector<HTMLButtonElement>('[data-spotlight-play]');
  if (slides.length < 2 || !controls || !play) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0; let hovered = false; let focused = root.contains(document.activeElement);
  let visible = !('IntersectionObserver' in window); let timer: number | undefined;
  const automatic = () => getAppearance().slideshow === 'auto' && !reducedMotion.matches;
  const schedule = () => {
    window.clearTimeout(timer); timer = undefined;
    const running = automatic() && visible && !hovered && !focused && !document.hidden;
    root.dataset.playback = reducedMotion.matches ? 'reduced' : automatic() ? (running ? 'playing' : 'paused') : 'manual';
    if (running) timer = window.setTimeout(() => show(index + 1, false), 8_000);
  };
  const show = (next: number, announce: boolean) => {
    const hadSlideFocus = slides[index]!.contains(document.activeElement);
    slides[index]!.hidden = true;
    index = (next + slides.length) % slides.length;
    const current = slides[index]!;
    current.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((image) => {
      image.src = image.dataset.src!; image.removeAttribute('data-src');
    });
    current.hidden = false;
    if (hadSlideFocus) current.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
    const position = controls.querySelector<HTMLElement>('[data-spotlight-position]');
    if (position) position.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    if (announce) {
      const status = controls.querySelector<HTMLElement>('[data-spotlight-announcement]');
      if (status) status.textContent = `Release ${index + 1} of ${slides.length}: ${current.querySelector('a')?.getAttribute('aria-label')?.replace(/^Open /, '') ?? ''}`;
    }
    schedule();
  };
  const syncPlayback = () => {
    const auto = automatic();
    play.disabled = reducedMotion.matches;
    play.setAttribute('aria-label', reducedMotion.matches ? 'Automatic playback is off with reduced motion' : auto ? 'Pause release slideshow' : 'Play release slideshow');
    play.title = reducedMotion.matches ? 'Use the arrows to browse at your own pace.' : '';
    const pauseIcon = play.querySelector<HTMLElement>('[data-pause-icon]');
    const playIcon = play.querySelector<HTMLElement>('[data-play-icon]');
    const label = play.querySelector<HTMLElement>('[data-play-label]');
    if (pauseIcon) pauseIcon.hidden = !auto;
    if (playIcon) playIcon.hidden = auto;
    if (label) label.textContent = reducedMotion.matches ? 'Manual' : auto ? 'Pause' : 'Play';
    const mode = controls.querySelector<HTMLElement>('[data-spotlight-mode]');
    if (mode) mode.textContent = auto ? 'Auto' : 'Manual';
    schedule();
  };
  controls.querySelector('[data-spotlight-previous]')?.addEventListener('click', () => show(index - 1, true));
  controls.querySelector('[data-spotlight-next]')?.addEventListener('click', () => show(index + 1, true));
  play.addEventListener('click', () => setAppearance({ slideshow: getAppearance().slideshow === 'auto' ? 'manual' : 'auto' }));
  root.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    show(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1), true);
  });
  root.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
  root.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  root.addEventListener('focusin', () => { focused = true; schedule(); });
  root.addEventListener('focusout', (event) => { focused = event.relatedTarget instanceof Node && root.contains(event.relatedTarget); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('yuuki:appearance-change', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = (entry?.intersectionRatio ?? 0) >= .3; schedule(); }, { threshold: .3 }).observe(root);
  controls.hidden = false; syncPlayback(); root.dataset.ready = 'true';
});
