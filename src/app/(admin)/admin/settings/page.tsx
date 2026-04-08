'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import SettingsTabs from '@/components/admin/SettingsTabs';
import { Plus, Trash2 } from 'lucide-react';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-100 animate-pulse rounded-lg border-2 border-gray-200" />
});

export default function SettingsPage() {
  const { isLoaded, userId } = useAuth();
  
  // PWA Banner States
  const [bannerContent, setBannerContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  
  // Static Group Colors States
  const [staticColors, setStaticColors] = useState<string[]>(['Blu', 'Rosso', 'Giallo', 'Verde', 'Arancione', 'Viola', 'Grigio']);
  const [newColor, setNewColor] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [bannerRes, colorsRes] = await Promise.all([
          fetch('/api/admin/settings?key=pwa_banner_config'),
          fetch('/api/admin/settings?key=static_groups_colors')
        ]);
        
        if (bannerRes.ok) {
          const json = await bannerRes.json();
          if (json.data && json.data.value?.html) {
            setInitialContent(json.data.value.html);
            setBannerContent(json.data.value.html);
          }
        }
        
        if (colorsRes.ok) {
          const json = await colorsRes.json();
          if (json.data && Array.isArray(json.data.value?.colors)) {
            setStaticColors(json.data.value.colors);
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
      const bannerPromise = fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'pwa_banner_config',
          value: { html: bannerContent },
          description: 'Contenuto Rich Text per il banner di installazione della PWA'
        })
      });

      const colorsPromise = fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'static_groups_colors',
          value: { colors: staticColors },
          description: 'Colori usati per la generazione dei gruppi statici CRM'
        })
      });

      const [bannerRes, colorsRes] = await Promise.all([bannerPromise, colorsPromise]);

      if (!bannerRes.ok) {
        const errorData = await bannerRes.json();
        throw new Error(errorData.error || 'Errore durante il salvataggio del banner PWA');
      }

      if (!colorsRes.ok) {
        const errorData = await colorsRes.json();
        throw new Error(errorData.error || 'Errore durante il salvataggio dei colori');
      }

      setMessage({ type: 'success', text: 'Impostazioni salvate con successo!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddColor = () => {
    if (newColor.trim() && !staticColors.includes(newColor.trim())) {
      setStaticColors([...staticColors, newColor.trim()]);
      setNewColor('');
    }
  };

  const handleRemoveColor = (colorToRemove: string) => {
    setStaticColors(staticColors.filter(c => c !== colorToRemove));
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
      <SettingsTabs />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Impostazioni App</h1>
        <p className="mt-2 text-gray-600">
          Gestisci le configurazioni globali dell'applicazione.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Banner Installazione App (PWA)</h2>
          <p className="mt-1 text-sm text-gray-500">
            Questo testo verrà mostrato agli utenti non ancora accreditati o che non hanno installato l'app.
          </p>
        </div>
        
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contenuto del Banner
          </label>
          <RichTextEditor 
            initialHtml={initialContent} 
            onChange={(html) => setBannerContent(html)} 
            placeholder="Scrivi qui il messaggio..."
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Colori Gruppi Statici</h2>
          <p className="mt-1 text-sm text-gray-500">
            Definisci i colori che verranno utilizzati durante la generazione automatica dei gruppi statici nel CRM.
          </p>
        </div>
        
        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {staticColors.map(color => (
              <span key={color} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                {color}
                <button
                  onClick={() => handleRemoveColor(color)}
                  className="ml-1 text-gray-400 hover:text-red-500 focus:outline-none transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            ))}
            {staticColors.length === 0 && (
              <span className="text-sm text-gray-500 italic">Nessun colore definito. Verranno usati i colori di default.</span>
            )}
          </div>
          <div className="flex gap-2 max-w-sm">
            <input
              type="text"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddColor()}
              placeholder="Nuovo colore..."
              className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-agesci-blue focus:ring-agesci-blue sm:text-sm px-4 py-2 border"
            />
            <button
              onClick={handleAddColor}
              disabled={!newColor.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-agesci-blue hover:bg-agesci-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-agesci-blue disabled:opacity-50 transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-6 flex justify-end items-center gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-200 shadow-sm">
        {message && (
          <div className={`p-2 px-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}
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
            'Salva Tutte Le Impostazioni'
          )}
        </button>
      </div>
    </div>
  );
}
