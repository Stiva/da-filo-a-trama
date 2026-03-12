'use client';

import { useState, useEffect, useCallback } from 'react';

// Questa interfaccia estende BeforeInstallPromptEvent standard (che non e' ancora del tutto supportata nei type default di TS)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePwaAndPush() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [isIosInstallable, setIsIosInstallable] = useState(false);

  useEffect(() => {
    // 1. Controlliamo se e' gia' installata testando il display-mode
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Safari iOS // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isIosStandalone = ('standalone' in window.navigator) && ((window.navigator as any).standalone === true);
      setIsInstalled(isStandalone || isIosStandalone);
    };
    checkIfInstalled();

    // 1b. Check if device is iOS and not already installed
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    setIsIosInstallable(isIos() && !isInstalled);

    // 2. Registrazione Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrato con scope:', registration.scope);
          setIsServiceWorkerReady(true);
        })
        .catch((error) => {
          console.error('Registrazione Service Worker fallita:', error);
        });
    }

    // 3. Gestione PWA Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('PWA è stata installata correttamente');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const subscribeToPush = useCallback(async (applicationServerKey: string) => {
    if (!isServiceWorkerReady) {
      throw new Error("Service Worker non ancora pronto.");
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error("Push notifications non supportate su questo browser.");
    }

    const permission = await Notification.requestPermission();
    setPushStatus(permission);

    if (permission !== 'granted') {
      throw new Error("Permesso notifiche negato.");
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
      });
    }

    // Salvataggio della subscription a DB via nostra API
    const response = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription)
    });

    if (!response.ok) {
      throw new Error('Errore nel salvataggio della subscription a DB.');
    }

    return subscription;
  }, [isServiceWorkerReady]);

  return {
    isInstallable,
    isIosInstallable,
    isInstalled,
    pushStatus,
    promptInstall,
    subscribeToPush
  };
}
