'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
    id: string;
    name: string;
}

interface AutocompleteProps {
    value: string;
    onChange: (val: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export default function Autocomplete({
    value,
    onChange,
    options,
    placeholder,
    className = '',
    required
}: AutocompleteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(inputValue.toLowerCase())
    );

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    onChange(e.target.value); // keep it synced
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className="input w-full"
                placeholder={placeholder}
                required={required}
            />
            {/* Visualizza anche un'opzione 'Nessun gruppo' o svuota la selezione se necessario */}
            {isOpen && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => (
                            <li
                                key={opt.id}
                                className="px-4 py-2 cursor-pointer hover:bg-agesci-blue/5 text-gray-700 hover:text-agesci-blue transition-colors text-sm"
                                onClick={() => {
                                    setInputValue(opt.name);
                                    onChange(opt.name);
                                    setIsOpen(false);
                                }}
                            >
                                {opt.name}
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-3 text-sm text-gray-500 italic">
                            Nessun gruppo trovato{inputValue ? ` per "${inputValue}"` : ''}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
