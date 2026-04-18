'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X, Search } from 'lucide-react';
import { FilterType } from '@/hooks/useTableFilters';

interface ColumnFilterProps {
  columnId: string;
  label: string;
  type: FilterType;
  value: any;
  options?: { value: string; label: string }[];
  onChange: (value: any) => void;
  placeholder?: string;
}

export default function ColumnFilter({
  columnId,
  label,
  type,
  value,
  options,
  onChange,
  placeholder = 'Filtra...'
}: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = value !== undefined && value !== null && value !== '';

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus input on open
      if (type === 'text') {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, type]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block ml-1" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded-md transition-colors hover:bg-black/5 ${
          isActive ? 'text-agesci-blue bg-agesci-blue/10' : 'text-gray-400'
        }`}
        title={`Filtra per ${label}`}
      >
        <Filter className={`w-3.5 h-3.5 ${isActive ? 'fill-current' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 mt-1 left-0 w-64 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 p-3 animate-in fade-in zoom-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {label}
            </span>
            {isActive && (
              <button
                onClick={handleClear}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Pulisci
              </button>
            )}
          </div>

          {type === 'text' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="input w-full pl-9 h-9 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && setIsOpen(false)}
              />
            </div>
          )}

          {type === 'select' && options && (
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              <button
                onClick={() => { onChange(''); setIsOpen(false); }}
                className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                  !isActive ? 'bg-agesci-blue/10 text-agesci-blue font-medium' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                Tutti
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                    value === opt.value ? 'bg-agesci-blue/10 text-agesci-blue font-medium' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {type === 'boolean' && (
            <div className="flex gap-2">
              <button
                onClick={() => { onChange('true'); setIsOpen(false); }}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md border ${
                  value === 'true' ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                Sì
              </button>
              <button
                onClick={() => { onChange('false'); setIsOpen(false); }}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md border ${
                  value === 'false' ? 'bg-red-50 border-red-200 text-red-700 font-medium' : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                No
              </button>
            </div>
          )}

          {type === 'date' && (
            <input
              type="date"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="input w-full h-9 text-sm"
            />
          )}

          <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs font-medium text-white bg-agesci-blue rounded hover:bg-agesci-blue-light transition-colors"
            >
              Applica
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
