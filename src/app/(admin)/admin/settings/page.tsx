'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-100 animate-pulse rounded-lg border-2 border-gray-200" />
});

export default function SettingsPage() {
  const { isLoaded, userId } = useAuth();
  const [bannerContent, setBannerContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/settings?key=pwa_banner_config');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.value?.html) {
            setInitialContent(json.data.value.html);
            setBannerContent(json.data.value.html);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (isLoaded && userId) {
      loadSettings();
    }
  }, [isLoaded, userId]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'pwa_banner_config',
          value: { html: bannerContent },
          description: 'Contenuto Rich Text per il banner di installazione della PWA'
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Errore durante il salvataggio');
      }

      setMessage({ type: 'success', text: 'Impostazioni salvate con successo!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-agesci-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Impostazioni App</h1>
        <p className="mt-2 text-gray-600">
          Gestisci le configurazioni globali dell'applicazione.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Banner Installazione App (PWA)</h2>
          <p className="mt-1 text-sm text-gray-500">
            Questo testo verrà mostrato agli utenti non ancora accreditati o che non hanno installato l'app, per invitarli ad aggiungere l'applicazione alla schermata Home.
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contenuto del Banner
            </label>
            <RichTextEditor 
              initialHtml={initialContent} 
              onChange={(html) => setBannerContent(html)} 
              placeholder="Scrivi qui il messaggio per invitare gli utenti ad installare l'app..."
            />
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-agesci-blue hover:bg-agesci-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-agesci-blue disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvataggio...
                </>
              ) : (
                'Salva Impostazioni'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
