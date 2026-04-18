/**
 * Utility per l'esportazione di dati in formato CSV
 */

export interface ExportColumn {
  id: string;
  label: string;
}

/**
 * Esporta un array di oggetti in formato CSV
 * @param data Array di oggetti da esportare
 * @param visibleColumns Colonne da includere nell'export
 * @param fileName Nome del file (senza estensione)
 */
export function exportToCSV(data: any[], visibleColumns: ExportColumn[], fileName: string) {
  if (data.length === 0) return;

  // Header
  const headers = visibleColumns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');

  // Rows
  const rows = data.map(item => {
    return visibleColumns.map(col => {
      let value = item[col.id];
      
      // Gestione valori null/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Gestione booleani
      if (typeof value === 'boolean') {
        value = value ? 'Sì' : 'No';
      }

      // Gestione oggetti/array
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }

      // Escape dei doppi apici per il formato CSV
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const fullFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
  link.setAttribute('download', fullFileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
