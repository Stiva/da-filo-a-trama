'use client';

import { useState, useEffect, useCallback } from 'react';

interface Profile {
  id: string;
  name: string | null;
  surname: string | null;
  email: string;
  scout_group: string | null;
}

interface AddEnrollmentModalProps {
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEnrollmentModal({
  eventId,
  onClose,
  onSuccess,
}: AddEnrollmentModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=10`);
      const result = await response.json();

      if (response.ok && result.data) {
        setSearchResults(result.data);
      }
    } catch (err) {
      console.error('Errore ricerca utenti:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

  const handleSubmit = async () => {
    if (!selectedProfile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/events/${eventId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfile.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore durante l\'aggiunta');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFullName = (profile: Profile) => {
    return [profile.name, profile.surname].filter(Boolean).join(' ') || profile.email;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Aggiungi Iscrizione</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Search Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cerca utente
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedProfile(null);
                }}
                placeholder="Nome, cognome o email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-agesci-blue focus:border-transparent"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Digita almeno 2 caratteri per cercare
            </p>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && !selectedProfile && (
            <div className="mb-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
              {searchResults.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedProfile(profile)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    {getFullName(profile)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {profile.email}
                    {profile.scout_group && ` - ${profile.scout_group}`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected Profile */}
          {selectedProfile && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-800">
                    {getFullName(selectedProfile)}
                  </p>
                  <p className="text-sm text-green-600">
                    {selectedProfile.email}
                    {selectedProfile.scout_group && ` - ${selectedProfile.scout_group}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProfile(null)}
                  className="text-green-600 hover:text-green-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* No Results */}
          {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && !selectedProfile && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center text-gray-500">
              Nessun utente trovato per &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedProfile || isSubmitting}
            className="px-4 py-2 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Aggiunta in corso...' : 'Aggiungi Iscrizione'}
          </button>
        </div>
      </div>
    </div>
  );
}
