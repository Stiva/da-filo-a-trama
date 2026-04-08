import { useState, useEffect } from 'react';
import type { PoiCategory, Poi } from '@/types/database';
import { POI_TYPE_LABELS } from '@/types/database';

interface AreaEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Poi>) => Promise<void>;
  initialData?: Partial<Poi> | null;
}

export default function AreaEditModal({ isOpen, onClose, onSave, initialData }: AreaEditModalProps) {
  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [tipo, setTipo] = useState<PoiCategory>('area');
  const [color, setColor] = useState('#3b82f6');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNome(initialData?.nome || '');
      setDescrizione(initialData?.descrizione || '');
      setTipo(initialData?.tipo || 'area');
      setColor(initialData?.color || '#3b82f6');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        ...initialData,
        nome,
        descrizione,
        tipo,
        color,
        is_active: true
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Errore durante il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {initialData?.id ? 'Modifica Area' : 'Nuova Area'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Es. Area Stand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione
            </label>
            <textarea
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Categoria (Icona logica)</label>
             <select
               value={tipo}
               onChange={(e) => setTipo(e.target.value as PoiCategory)}
               className="w-full px-3 py-2 border rounded-md"
             >
               {Object.entries(POI_TYPE_LABELS).map(([val, label]) => (
                 <option key={val} value={val}>{label}</option>
               ))}
             </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colore area
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 border-0 p-0 rounded-md"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md uppercase"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
