export function initCopyButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy-target]').forEach((button) => {
    if (button.dataset.copyReady) return;
    button.dataset.copyReady = 'true';
    button.addEventListener('click', async (event) => {
      event.preventDefault(); event.stopPropagation();
      const target = document.getElementById(button.dataset.copyTarget ?? '');
      if (!target) return;
      const previous = button.textContent ?? 'Copy';
      try { await navigator.clipboard.writeText(target.querySelector('code')?.textContent ?? target.textContent ?? ''); button.textContent = 'Copied'; }
      catch { button.textContent = 'Select to copy'; }
      setTimeout(() => { button.textContent = previous; }, 1800);
    });
  });
}
