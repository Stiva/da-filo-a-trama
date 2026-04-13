'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import SettingsTabs from '@/components/admin/SettingsTabs';
import Image from 'next/image';
import { Trash2, GripVertical, Plus, ExternalLink, Upload, X, Check } from 'lucide-react';

interface Sponsor {
  id: string;
  name: string;
  url: string;
  image_url: string;
  sort_order: number;
}

export default function SponsorsPage() {
  const { isLoaded, userId } = useAuth();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form per nuovo sponsor
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isLoaded && userId) {
      loadSponsors();
    }
  }, [isLoaded, userId]);

  async function loadSponsors() {
    try {
      const res = await fetch('/api/admin/settings?key=footer_sponsors');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data.value?.sponsors)) {
          setSponsors(json.data.value.sponsors);
        } else {
          setSponsors([]);
        }
      }
    } catch (e) {
      console.error('Failed to load sponsors:', e);
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setNewLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setNewLogoPreview(null);
    }
  }

  async function handleAddSponsor() {
    if (!newName.trim() || !newUrl.trim() || !newLogoFile) {
      setMessage({ type: 'error', text: 'Nome, URL e logo sono obbligatori.' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      // 1. Upload logo
      const fd = new FormData();
      fd.append('logo', newLogoFile);
      const uploadRes = await fetch('/api/admin/sponsors', {
        method: 'POST',
        body: fd,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Errore nel caricamento del logo');
      }
      const { data: { url: imageUrl } } = await uploadRes.json();

      // 2. Add to list
      const newSponsor: Sponsor = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
        image_url: imageUrl,
        sort_order: sponsors.length,
      };
      const updatedSponsors = [...sponsors, newSponsor];
      setSponsors(updatedSponsors);

      // 3. Save to settings
      await saveSponsors(updatedSponsors);

      // Reset form
      setNewName('');
      setNewUrl('');
      setNewLogoFile(null);
      setNewLogoPreview(null);
      setShowAddForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteSponsor(sponsor: Sponsor) {
    if (!confirm(`Rimuovere il patrocinio "${sponsor.name}"? Il logo verrà eliminato dallo storage.`)) return;

    // Delete logo from storage
    try {
      await fetch(`/api/admin/sponsors?url=${encodeURIComponent(sponsor.image_url)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('Could not delete logo from storage:', e);
    }

    const updated = sponsors.filter(s => s.id !== sponsor.id).map((s, i) => ({ ...s, sort_order: i }));
    setSponsors(updated);
    await saveSponsors(updated);
  }

  async function handleUpdateSponsor(id: string, field: 'name' | 'url', value: string) {
    const updated = sponsors.map(s => s.id === id ? { ...s, [field]: value } : s);
    setSponsors(updated);
  }

  async function handleSaveInlineEdit() {
    await saveSponsors(sponsors);
  }

  async function saveSponsors(list: Sponsor[]) {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'footer_sponsors',
          value: { sponsors: list },
          description: 'Loghi e link dei patrocini mostrati nel footer del sito',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore durante il salvataggio');
      }
      setMessage({ type: 'success', text: 'Modifiche salvate con successo!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  }

  // Drag-and-drop reorder
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const reordered = [...sponsors];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }));
    setSponsors(withOrder);
    setDragIndex(null);
    setDragOverIndex(null);
    saveSponsors(withOrder);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-agesci-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <SettingsTabs />

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Loghi Patrocinatori</h1>
          <p className="mt-2 text-gray-600">
            Gestisci i loghi e i link dei patrocini mostrati nel footer del sito. Trascina per riordinare.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-agesci-blue text-white rounded-xl font-medium text-sm hover:bg-agesci-blue/90 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Aggiungi Logo
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Add form modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Aggiungi Patrocinio</h2>
              <button
                onClick={() => { setShowAddForm(false); setNewName(''); setNewUrl(''); setNewLogoFile(null); setNewLogoPreview(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome Ente / Organizzazione *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Es. Comune di Castelfranco Emilia"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  URL del sito *
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://www.esempio.it"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Logo *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${newLogoPreview
                    ? 'border-agesci-blue/40 bg-agesci-blue/5'
                    : 'border-gray-300 hover:border-agesci-blue/50 hover:bg-gray-50'
                    }`}
                >
                  {newLogoPreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative w-24 h-16">
                        <Image src={newLogoPreview} alt="Anteprima" fill className="object-contain" />
                      </div>
                      <span className="text-sm text-gray-500">{newLogoFile?.name}</span>
                      <span className="text-xs text-agesci-blue font-medium">Clicca per cambiare</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm font-medium">Clicca per caricare un logo</span>
                      <span className="text-xs">JPG, PNG, WEBP, SVG — max 5MB</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => { setShowAddForm(false); setNewName(''); setNewUrl(''); setNewLogoFile(null); setNewLogoPreview(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleAddSponsor}
                disabled={isUploading || !newName.trim() || !newUrl.trim() || !newLogoFile}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-agesci-blue text-white rounded-xl hover:bg-agesci-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Caricamento...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Aggiungi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sponsors list */}
      {sponsors.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Nessun patrocinio configurato</p>
          <p className="text-sm text-gray-400 mt-1">Aggiungi il primo logo con il pulsante in alto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sponsors
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((sponsor, index) => (
              <div
                key={sponsor.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${dragOverIndex === index && dragIndex !== index
                  ? 'border-agesci-blue shadow-md scale-[1.01]'
                  : 'border-gray-200 hover:border-gray-300'
                  } ${dragIndex === index ? 'opacity-50' : 'opacity-100'}`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors shrink-0">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Logo preview */}
                  <div className="relative w-20 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    <Image
                      src={sponsor.image_url}
                      alt={sponsor.name}
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>

                  {/* Fields */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <input
                      type="text"
                      value={sponsor.name}
                      onChange={e => handleUpdateSponsor(sponsor.id, 'name', e.target.value)}
                      onBlur={handleSaveInlineEdit}
                      placeholder="Nome ente"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={sponsor.url}
                        onChange={e => handleUpdateSponsor(sponsor.id, 'url', e.target.value)}
                        onBlur={handleSaveInlineEdit}
                        placeholder="https://..."
                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:border-transparent min-w-0"
                      />
                      <a
                        href={sponsor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-2 text-gray-400 hover:text-agesci-blue transition-colors"
                        title="Apri sito"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteSponsor(sponsor)}
                    className="shrink-0 p-2 text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                    title="Rimuovi patrocinio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Preview section */}
      {sponsors.length > 0 && (
        <div className="mt-10 bg-[#1e3a5f] rounded-2xl p-6">
          <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-4">Anteprima Footer</p>
          <p className="text-sm text-white/80 font-medium mb-3">Evento realizzato con il contributo di:</p>
          <div className="flex flex-wrap items-center gap-4">
            {sponsors
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(sponsor => (
                <a
                  key={sponsor.id}
                  href={sponsor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-transform hover:scale-105 bg-white p-2 rounded-xl h-16 flex items-center justify-center shadow-lg"
                  title={sponsor.name}
                >
                  <div className="relative h-12 w-20">
                    <Image
                      src={sponsor.image_url}
                      alt={sponsor.name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </a>
              ))}
          </div>
        </div>
      )}

      {/* Save indicator */}
      {isSaving && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-2 text-sm text-gray-700">
          <svg className="animate-spin w-4 h-4 text-agesci-blue" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Salvataggio...
        </div>
      )}
    </div>
  );
}
