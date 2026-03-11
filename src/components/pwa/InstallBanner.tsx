'use client';

import { useEffect, useState } from 'react';
import { usePwaAndPush } from '@/hooks/usePwaAndPush';

export default function InstallBanner() {
  const { isInstallable, isIosInstallable, isInstalled, promptInstall, subscribeToPush } = usePwaAndPush();
  const [bannerHtml, setBannerHtml] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Recupera il contenuto testuale
  useEffect(() => {
    async function fetchBannerConfig() {
      try {
        const res = await fetch('/api/settings?key=pwa_banner_config');
        if (res.ok) {
          const json = await res.json();
          if (json.data?.html) {
            setBannerHtml(json.data.html);
          }
        }
      } catch (err) {
        console.error('Errore fetch banner config:', err);
      }
    }
    fetchBannerConfig();
  }, []);

  // Mostra il banner se l'app è installabile, non è già installata e non è stata ignorata
  useEffect(() => {
    // Non mostrare durante SSR
    if (typeof window === 'undefined') return;
    
    // Controlliamo in locale se l'utente l'ha chiuso
    const isDismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    if ((isInstallable || isIosInstallable) && !isInstalled && bannerHtml) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isInstallable, isIosInstallable, isInstalled, bannerHtml]);

  if (!isVisible || dismissed || !bannerHtml) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.1)] border-t border-gray-200">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Contenuto Rich Text (Lexical genera HTML pulito che iniettiamo qui) */}
        <div 
          className="prose prose-sm max-w-none text-gray-700 flex-1"
          dangerouslySetInnerHTML={{ __html: bannerHtml }}
        />
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <button 
            onClick={handleDismiss}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Più tardi
          </button>
          
          {isIosInstallable && !isInstallable ? (
            <div className="w-full sm:w-auto text-xs text-blue-800 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 mt-2 sm:mt-0">
              Tocca <strong>Condividi</strong> in basso<br className="hidden sm:block" /> e poi <strong>Aggiungi alla schermata Home</strong>
            </div>
          ) : (
            <button 
              onClick={promptInstall}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-agesci-blue hover:bg-agesci-blue/90 rounded-lg shadow-sm transition-colors"
            >
              Installa App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
