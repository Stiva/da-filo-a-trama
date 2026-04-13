'use client';

import { useState, useRef, useEffect } from 'react';
import { Columns } from 'lucide-react';
import { ColumnDef } from '@/hooks/useAdminTablePreferences';

interface ColumnSelectorProps {
  availableColumns: ColumnDef[];
  visibleColumns: string[];
  onToggleColumn: (id: string, isVisible: boolean) => void;
  isLoading?: boolean;
}

export default function ColumnSelector({ availableColumns, visibleColumns, onToggleColumn, isLoading }: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="h-9 w-9 md:w-auto animate-pulse bg-gray-200 rounded-md"></div>
    );
  }

  const allSelected = availableColumns.every(col => visibleColumns.includes(col.id));

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        className="inline-flex justify-center items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-agesci-blue"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Colonne tabella"
      >
        <Columns className="w-4 h-4 text-gray-500" />
        <span className="hidden md:inline">Viste</span>
        <svg className="w-4 h-4 -mr-1 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 focus:outline-none">
          <div className="py-1 px-2" role="menu" aria-orientation="vertical">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
              Scegli le colonne
            </div>
            
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                {availableColumns.map((col) => {
                const isVisible = visibleColumns.includes(col.id);
                // Prevent unchecking the last option
                const isLastVisible = isVisible && visibleColumns.length === 1;

                return (
                    <label 
                      key={col.id} 
                      className={`flex items-center px-2 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                        isLastVisible ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                      }`}
                    >
                    <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => {
                            if (isLastVisible && !e.target.checked) return;
                            onToggleColumn(col.id, e.target.checked);
                        }}
                        disabled={isLastVisible}
                        className="h-4 w-4 text-agesci-blue focus:ring-agesci-blue border-gray-300 rounded"
                    />
                    <span className="ml-3 text-gray-700 truncate">{col.label}</span>
                    </label>
                );
                })}
            </div>

            {/* Quick Actions */}
            <div className="mt-2 pt-2 border-t border-gray-100 px-3 pb-2 flex gap-2 justify-between">
              {!allSelected && (
                 <button 
                  onClick={() => {
                    // Turn on everything not currently visible
                    availableColumns.forEach(c => {
                      if (!visibleColumns.includes(c.id)) {
                        onToggleColumn(c.id, true);
                      }
                    });
                  }}
                  className="text-xs text-agesci-blue hover:underline whitespace-nowrap"
                 >
                   Seleziona tutte
                 </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
