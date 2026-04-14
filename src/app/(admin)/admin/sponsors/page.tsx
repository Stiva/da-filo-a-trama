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

interface SponsorSection {
  id: string;
  title: string;
  sponsors: Sponsor[];
}

const DEFAULT_SECTIONS: SponsorSection[] = [
  { id: '1', title: 'Evento realizzato con il contributo di:', sponsors: [] },
  { id: '2', title: '', sponsors: [] },
  { id: '3', title: '', sponsors: [] }
];

export default function SponsorsPage() {
  const { isLoaded, userId } = useAuth();

  const [sections, setSections] = useState<SponsorSection[]>(DEFAULT_SECTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form per nuovo sponsor
  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag state scoped per section
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isLoaded && userId) {
      loadSettings();
    }
  }, [isLoaded, userId]);

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings?key=footer_sponsors');
      if (res.ok) {
        const json = await res.json();
        const data = json.data?.value;
        if (data) {
          if (Array.isArray(data.sections)) {
            // Uniamo le sezioni con il template default (garantisce sempre 3 sezioni nella UI)
            const loaded = data.sections as SponsorSection[];
            const merged = DEFAULT_SECTIONS.map(def => {
              const sf = loaded.find(s => s.id === def.id);
              return sf ? { ...sf, sponsors: sf.sponsors || [] } : def;
            });
            setSections(merged);
          } else if (Array.isArray(data.sponsors)) {
            // Retrocompatibilità
            setSections([
              { id: '1', title: 'Evento realizzato con il contributo di:', sponsors: data.sponsors },
              { id: '2', title: '', sponsors: [] },
              { id: '3', title: '', sponsors: [] }
            ]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load sections:', e);
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
    if (!addingToSectionId || !newName.trim() || !newUrl.trim() || !newLogoFile) {
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

      // 2. Add to targeted section
      const newSponsor: Sponsor = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
        image_url: imageUrl,
        sort_order: sections.find(s => s.id === addingToSectionId)?.sponsors.length || 0,
      };

      const updatedSections = sections.map(sec => {
        if (sec.id === addingToSectionId) {
          return { ...sec, sponsors: [...sec.sponsors, newSponsor] };
        }
        return sec;
      });

      setSections(updatedSections);
      await saveSections(updatedSections);

      // Reset form
      closeAddForm();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  }

  function closeAddForm() {
    setAddingToSectionId(null);
    setNewName('');
    setNewUrl('');
    setNewLogoFile(null);
    setNewLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteSponsor(sectionId: string, sponsor: Sponsor) {
    if (!confirm(`Rimuovere il patrocinio "${sponsor.name}"? Il logo verrà eliminato dallo storage.`)) return;

    try {
      await fetch(`/api/admin/sponsors?url=${encodeURIComponent(sponsor.image_url)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('Could not delete logo from storage:', e);
    }

    const updatedSections = sections.map(sec => {
      if (sec.id === sectionId) {
        const updatedSponsors = sec.sponsors
          .filter(s => s.id !== sponsor.id)
          .map((s, i) => ({ ...s, sort_order: i }));
        return { ...sec, sponsors: updatedSponsors };
      }
      return sec;
    });

    setSections(updatedSections);
    await saveSections(updatedSections);
  }

  async function handleUpdateSponsor(sectionId: string, sponsorId: string, field: 'name' | 'url', value: string) {
    const updated = sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          sponsors: sec.sponsors.map(s => s.id === sponsorId ? { ...s, [field]: value } : s)
        };
      }
      return sec;
    });
    setSections(updated);
  }

  async function handleUpdateSectionTitle(sectionId: string, value: string) {
    const updated = sections.map(sec => sec.id === sectionId ? { ...sec, title: value } : sec);
    setSections(updated);
  }

  async function handleSaveInlineEdit() {
    await saveSections(sections);
  }

  async function saveSections(list: SponsorSection[]) {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'footer_sponsors',
          value: { sections: list },
          description: 'Sezioni sponsor e loghi dei patrocini mostrati nel footer',
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

  // Drag-and-drop reorder limitato all'interno della stessa sezione
  function handleDragStart(sectionId: string, index: number) {
    setDragSectionId(sectionId);
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, sectionId: string, index: number) {
    e.preventDefault();
    if (dragSectionId === sectionId) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(sectionId: string, targetIndex: number) {
    if (dragSectionId !== sectionId || dragIndex === null || dragIndex === targetIndex) return;
    
    const updatedSections = [...sections];
    const secIndex = updatedSections.findIndex(s => s.id === sectionId);
    if (secIndex === -1) return;

    const reorderedSponsors = [...updatedSections[secIndex].sponsors];
    const [moved] = reorderedSponsors.splice(dragIndex, 1);
    reorderedSponsors.splice(targetIndex, 0, moved);
    
    updatedSections[secIndex].sponsors = reorderedSponsors.map((s, i) => ({ ...s, sort_order: i }));

    setSections(updatedSections);
    handleDragEnd();
    saveSections(updatedSections);
  }

  function handleDragEnd() {
    setDragSectionId(null);
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

      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Sezioni Patrocini</h1>
        <p className="text-gray-600">
          Configura tre diverse sezioni di sponsor e patrocini. Ogni sezione è mostrata 
          sul sito solo se possiede almeno un logo al suo interno.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Rendering 3 Sezioni */}
      <div className="space-y-12">
        {sections.map((section, secIndex) => (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex-1">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                    SEZIONE {secIndex + 1}
                 </label>
                 <input
                    type="text"
                    value={section.title}
                    onChange={e => handleUpdateSectionTitle(section.id, e.target.value)}
                    onBlur={handleSaveInlineEdit}
                    placeholder="Es: Evento realizzato con il contributo di:"
                    className="w-full bg-transparent border-0 border-b border-dashed border-gray-300 focus:ring-0 focus:border-agesci-blue p-0 text-lg font-semibold text-gray-900 placeholder:text-gray-300"
                 />
              </div>
              <button
                onClick={() => setAddingToSectionId(section.id)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Logo
              </button>
            </div>

            <div className="p-5">
              {section.sponsors.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400 font-medium">Questa sezione è attualmente invisibile</p>
                  <p className="text-xs text-gray-300 mt-1">Aggiungi un logo per abilitarla nel sito</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {section.sponsors
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((sponsor, index) => (
                      <div
                        key={sponsor.id}
                        draggable
                        onDragStart={() => handleDragStart(section.id, index)}
                        onDragOver={(e) => handleDragOver(e, section.id, index)}
                        onDrop={() => handleDrop(section.id, index)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white rounded-xl border shadow-sm transition-all ${dragOverIndex === index && dragIndex !== index && dragSectionId === section.id
                          ? 'border-agesci-blue shadow-md scale-[1.01]'
                          : 'border-gray-200 hover:border-gray-300'
                          } ${dragIndex === index && dragSectionId === section.id ? 'opacity-50' : 'opacity-100'}`}
                      >
                        <div className="flex items-center gap-4 p-3">
                          <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors shrink-0">
                            <GripVertical className="w-5 h-5" />
                          </div>

                          <div className="relative w-16 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden px-1">
                            <Image
                              src={sponsor.image_url}
                              alt={sponsor.name}
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>

                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                            <input
                              type="text"
                              value={sponsor.name}
                              onChange={e => handleUpdateSponsor(section.id, sponsor.id, 'name', e.target.value)}
                              onBlur={handleSaveInlineEdit}
                              placeholder="Nome ente"
                              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="url"
                                value={sponsor.url}
                                onChange={e => handleUpdateSponsor(section.id, sponsor.id, 'url', e.target.value)}
                                onBlur={handleSaveInlineEdit}
                                placeholder="https://..."
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:border-transparent min-w-0"
                              />
                              <a
                                href={sponsor.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 p-1.5 text-gray-400 hover:text-agesci-blue transition-colors"
                                title="Apri sito"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteSponsor(section.id, sponsor)}
                            className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            title="Rimuovi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add form modal */}
      {addingToSectionId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
               <h2 className="text-lg font-semibold text-gray-900">Aggiungi Logo</h2>
              <button
                onClick={closeAddForm}
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
                  placeholder="Es. Sponsor Tecnico"
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
                onClick={closeAddForm}
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

      {/* Save indicator */}
      {isSaving && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-2 text-sm text-gray-700 z-40">
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
