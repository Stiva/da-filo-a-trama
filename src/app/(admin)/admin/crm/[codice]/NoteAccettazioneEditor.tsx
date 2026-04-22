'use client';

import { useState } from 'react';
import { ClipboardEdit, Save, X } from 'lucide-react';

interface Props {
  codice: string;
  initialNote: string | null;
}

export default function NoteAccettazioneEditor({ codice, initialNote }: Props) {
  const [note, setNote] = useState(initialNote ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(note);

  const handleEdit = () => {
    setDraft(note);
    setEditing(true);
    setSaved(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/crm/participants/${encodeURIComponent(codice)}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_accettazione: draft.trim() || null }),
      });
      if (!res.ok) throw new Error('Errore salvataggio');
      setNote(draft.trim());
      setEditing(false);
      setSaved(true);
    } catch {
      alert('Errore nel salvataggio della nota.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-amber-50/50 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ClipboardEdit className="w-5 h-5 text-amber-600" />
          Note Accettazione
        </h3>
        {!editing && (
          <button
            onClick={handleEdit}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <ClipboardEdit className="w-4 h-4" />
            {note ? 'Modifica' : 'Aggiungi nota'}
          </button>
        )}
      </div>

      <div className="p-6">
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Inserisci note di accettazione per questo partecipante..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" /> Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {note ? (
              <p className="text-gray-900 whitespace-pre-wrap leading-relaxed bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-3 text-sm">
                {note}
              </p>
            ) : (
              <p className="text-gray-400 italic text-sm">Nessuna nota di accettazione.</p>
            )}
            {saved && (
              <p className="text-xs text-green-600 font-medium mt-2">Nota salvata.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
