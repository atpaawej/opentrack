let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;
let popstateListener: (() => void) | null = null;
let lastTrackedUrl = '';

export function setupPageviewTracking(onPageview: () => void): () => void {
  if (typeof window === 'undefined' || typeof history === 'undefined') {
    return () => {};
  }

  lastTrackedUrl = window.location ? window.location.href : '';

  const checkUrlChange = () => {
    const currentUrl = window.location ? window.location.href : '';
    if (currentUrl && currentUrl !== lastTrackedUrl) {
      lastTrackedUrl = currentUrl;
      onPageview();
    }
  };

  if (typeof history.pushState === 'function' && !originalPushState) {
    originalPushState = history.pushState;
    history.pushState = function (...args) {
      const res = originalPushState!.apply(this, args);
      checkUrlChange();
      return res;
    };
  }

  if (typeof history.replaceState === 'function' && !originalReplaceState) {
    originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const res = originalReplaceState!.apply(this, args);
      checkUrlChange();
      return res;
    };
  }

  if (!popstateListener && typeof window.addEventListener === 'function') {
    popstateListener = () => {
      checkUrlChange();
    };
    window.addEventListener('popstate', popstateListener);
  }

  return () => {
    teardownPageviewTracking();
  };
}

export function teardownPageviewTracking(): void {
  if (typeof history !== 'undefined') {
    if (originalPushState) {
      history.pushState = originalPushState;
      originalPushState = null;
    }
    if (originalReplaceState) {
      history.replaceState = originalReplaceState;
      originalReplaceState = null;
    }
  }
  if (typeof window !== 'undefined' && popstateListener) {
    window.removeEventListener('popstate', popstateListener);
    popstateListener = null;
  }
  lastTrackedUrl = '';
}
