import { useEffect, useState } from 'react';
import { activateUpdate, registerServiceWorker } from '../lib/registerSW';

/**
 * Registers the service worker and shows a small toast with a "Refresh" button
 * when a new version has been deployed. Mounted once at the app root so it works
 * regardless of which view (or login state) is showing.
 */
export default function UpdateToast() {
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    registerServiceWorker(setReg);
  }, []);

  if (!reg) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-50 flex animate-slide-up justify-center px-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <span className="text-sm text-gray-700 dark:text-gray-200">A new version is available.</span>
        <button
          type="button"
          onClick={() => activateUpdate(reg)}
          className="rounded-full bg-gray-900 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
