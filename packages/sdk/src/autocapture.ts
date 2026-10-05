let clickListener: ((event: MouseEvent) => void) | null = null;

export function setupAutocapture(
  onCapture: (properties: Record<string, unknown>) => void
): () => void {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return () => {};
  }

  teardownAutocapture();

  clickListener = (event: MouseEvent) => {
    try {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;

      const el = target.closest('button, a, input[type="submit"]');
      if (!el) return;

      const tagName = el.tagName.toLowerCase();
      let text = '';
      if (tagName === 'input') {
        text = (el as HTMLInputElement).value || '';
      } else {
        text = el.textContent ? el.textContent.trim() : target.textContent ? target.textContent.trim() : '';
      }
      if (text.length > 255) {
        text = text.substring(0, 255);
      }

      const classes = el.className && typeof el.className === 'string' ? el.className.trim() : '';

      const properties: Record<string, unknown> = {
        $el_tag_name: tagName,
      };

      if (el.id) {
        properties.$el_id = el.id;
      }
      if (text) {
        properties.$el_text = text;
      }
      if (classes) {
        properties.$el_classes = classes;
      }
      if (tagName === 'a') {
        const href = el.getAttribute('href');
        if (href) {
          properties.$el_href = href;
        }
      }

      onCapture(properties);
    } catch {
      // Ignore DOM inspection errors
    }
  };

  document.addEventListener('click', clickListener, true);

  return () => {
    teardownAutocapture();
  };
}

export function teardownAutocapture(): void {
  if (typeof document !== 'undefined' && clickListener) {
    document.removeEventListener('click', clickListener, true);
    clickListener = null;
  }
}
