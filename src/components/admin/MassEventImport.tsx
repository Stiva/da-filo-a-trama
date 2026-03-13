'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

export default function MassEventImport({ onImportSuccess }: { onImportSuccess: () => void }) {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    // Definizione delle colonne del template
    const headers = [
      'Titolo (Obbligatorio)',
      'Categoria (workshop, conferenza, gioco, altro...)',
      'Data Inizio (YYYY-MM-DD HH:mm)',
      'Data Fine (YYYY-MM-DD HH:mm)',
      'Descrizione',
      'Max Posti (es. 50)',
      'Nome Speaker',
      'Bio Speaker',
      'Segnaposto (SI/NO)' // Per differenziare event placeholder (luogo pranzo ecc)
    ];

    const sampleRow = [
      'Grande Cerchio Iniziale',
      'altro',
      '2026-08-01 10:00',
      '2026-08-01 12:00',
      'Ritrovo e saluti iniziali',
      '500',
      '',
      '',
      'NO'
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    
    // Auto-size columns per leggibilità
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 20) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Eventi');
    
    XLSX.writeFile(wb, 'Template_Importazione_Eventi.xlsx');
  };

  const processImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      if (!workbook.SheetNames.length) throw new Error("File vuoto o non valido");
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
      if (rawJson.length < 2) throw new Error("Il file non contiene righe dati");

      const rows = rawJson.slice(1).filter(r => r.length > 0 && r[0]); // Skip header, skip completely empty rows

      const eventsPayload = rows.map((row) => ({
        title: row[0],
        category: typeof row[1] === 'string' ? row[1].toLowerCase() : 'altro',
        start_time: row[2] ? new Date(row[2]).toISOString() : new Date().toISOString(),
        end_time: row[3] ? new Date(row[3]).toISOString() : null,
        description: row[4] || '',
        max_posti: parseInt(row[5]) || 50,
        speaker_name: row[6] || '',
        speaker_bio: row[7] || '',
        is_placeholder: typeof row[8] === 'string' && row[8].toUpperCase() === 'SI'
      }));

      const res = await fetch('/api/admin/events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsPayload })
      });

      const jsonResp = await res.json();
      
      if (!res.ok) throw new Error(jsonResp.error || "Errore sconosciuto durante l'importazione");

      alert(jsonResp.message || 'Importazione Completata');
      onImportSuccess();
      
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto durante la lettura del file');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
      <button
        onClick={handleDownloadTemplate}
        className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex-1 sm:flex-none flex items-center justify-center gap-2 min-h-[44px]"
        title="Scarica template vuoto"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="text-sm">Template</span>
      </button>

      <div className="relative flex-1 sm:flex-none">
        <input
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          className="hidden"
          ref={fileInputRef}
          onChange={processImport}
          disabled={isImporting}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex-1 w-full flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
        >
          {isImporting ? (
             <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
          <span className="text-sm">{isImporting ? 'Import in corso...' : 'Importa EXCEL'}</span>
        </button>
      </div>
      
      {error && (
        <div className="absolute top-20 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 shadow-lg flex justify-between items-center min-w-[300px]">
           <p className="text-sm font-medium mr-4">{error}</p>
           <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
             &times;
           </button>
        </div>
      )}
    </div>
  );
}
