import { useState, useEffect } from 'react';

let deferredInstallPrompt: any = null;

// Register Service Worker for offline PWA capability
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('[PWA] ServiceWorker registration failed:', error);
        });
    });
  }

  // Capture install prompt event for PWA banner
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
}

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem('jcb_last_sync_time') || new Date().toLocaleTimeString();
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const now = new Date().toLocaleTimeString();
      setLastSyncTime(now);
      localStorage.setItem('jcb_last_sync_time', now);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check standalone display mode (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const checkInstallPrompt = () => {
      if (deferredInstallPrompt) {
        setCanInstall(true);
      }
    };

    const interval = setInterval(checkInstallPrompt, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const installPwa = async () => {
    if (!deferredInstallPrompt) return false;
    deferredInstallPrompt.prompt();
    const choiceResult = await deferredInstallPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
      deferredInstallPrompt = null;
      return true;
    }
    return false;
  };

  const syncDataNow = () => {
    const now = new Date().toLocaleTimeString();
    setLastSyncTime(now);
    localStorage.setItem('jcb_last_sync_time', now);
    // Trigger online storage event
    window.dispatchEvent(new Event('jcb_force_sync'));
  };

  return {
    isOnline,
    canInstall,
    isInstalled,
    installPwa,
    lastSyncTime,
    syncDataNow
  };
}
