'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
}

export function useAdminTablePreferences(tableKey: string, availableColumns: ColumnDef[]) {
  const defaultVisibleIds = availableColumns.filter(c => c.defaultVisible).map(c => c.id);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleIds);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch preferences on mount
  useEffect(() => {
    let mounted = true;

    async function loadPreferences() {
      try {
        const res = await fetch('/api/admin/preferences');
        if (!res.ok) throw new Error('Failed to load preferences');
        const json = await res.json();
        
        if (!mounted) return;
        
        const prefs = json.data?.tables?.[tableKey];
        if (prefs && Array.isArray(prefs)) {
          // Verify saved columns still exist in availableColumns
          const validSavedIds = prefs.filter(id => availableColumns.some(c => c.id === id));
          if (validSavedIds.length > 0) {
            setVisibleColumns(validSavedIds);
          }
        }
      } catch (err) {
        console.error('Error loading table preferences:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, [tableKey]); // Note: availableColumns is omitted to avoid infinite loops if passed inline

  // Toggle a single column visibility
  const toggleColumn = useCallback((columnId: string, isVisible: boolean) => {
    setVisibleColumns(prev => {
      const isCurrentlyVisible = prev.includes(columnId);
      let newCols = [...prev];
      
      if (isVisible && !isCurrentlyVisible) {
        // To keep the original order, filter available columns that are in the new set
        newCols.push(columnId);
        newCols = availableColumns.filter(c => newCols.includes(c.id)).map(c => c.id);
      } else if (!isVisible && isCurrentlyVisible) {
        // Don't allow hiding the very last column
        if (prev.length <= 1) return prev;
        newCols = prev.filter(id => id !== columnId);
      }
      
      // Fire-and-forget save
      fetch('/api/admin/preferences', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tables: {
                [tableKey]: newCols
            }
        })
      }).catch(err => console.error('Error saving preference:', err));

      return newCols;
    });
  }, [tableKey, availableColumns]);

  return {
    visibleColumns,
    toggleColumn,
    isLoading
  };
}
