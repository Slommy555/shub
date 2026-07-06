// Service-worker registration with update detection. The SW itself (public/sw.js)
// also powers reminder notifications, so registration is kept lightweight here
// and the update UX lives in src/components/UpdateToast.tsx.

type UpdateCallback = (reg: ServiceWorkerRegistration) => void;

/**
 * Register /sw.js and call `onUpdateReady` whenever a new worker has installed
 * and is waiting to take over (i.e. a real update, not the first install).
 */
export function registerServiceWorker(onUpdateReady: UpdateCallback): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // A worker may already be waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(reg);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // Installed + an existing controller => this is an update.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady(reg);
            }
          });
        });
      })
      .catch((err) => console.error('Service worker registration failed:', err));

    // Reload once the new worker takes control after SKIP_WAITING.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

/** Tell the waiting worker to activate; controllerchange then triggers a reload. */
export function activateUpdate(reg: ServiceWorkerRegistration): void {
  reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
