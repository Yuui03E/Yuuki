export function initCatalog(rootSelector: string, cardSelector: string, key: string) {
  document.querySelectorAll<HTMLElement>(rootSelector).forEach((root) => {
    const input = root.querySelector<HTMLInputElement>('[data-catalog-search]');
    const cards = Array.from(root.querySelectorAll<HTMLElement>(cardSelector));
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-catalog-filter]'));
    let filter = 'all';
    const apply = () => {
      const words = (input?.value ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      let count = 0;
      cards.forEach((card) => {
        card.hidden = !(words.every((word) => card.dataset.search?.includes(word)) && (filter === 'all' || card.dataset[key] === filter));
        if (!card.hidden) count++;
      });
      root.querySelector('[data-catalog-count]')!.textContent = `${count} of ${cards.length} entries`;
      root.querySelector<HTMLElement>('[data-catalog-empty]')!.hidden = count > 0;
    };
    input?.addEventListener('input', apply);
    buttons.forEach((button) => button.addEventListener('click', () => {
      filter = button.dataset.catalogFilter ?? 'all';
      buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      apply();
    }));
    apply();
  });
}
