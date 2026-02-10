'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AddEnrollmentModal from '@/components/AddEnrollmentModal';

interface Profile {
  id: string;
  clerk_id: string;
  name: string | null;
  surname: string | null;
  email: string;
  scout_group: string | null;
}

interface Enrollment {
  id: string;
  user_id: string;
  status: string;
  waitlist_position: number | null;
  created_at: string;
  profiles: Profile | null;
}

interface EventInfo {
  id: string;
  title: string;
  max_posti: number;
}

export default function EventEnrollmentsPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEnrollments();
    }
  }, [eventId]);

  const fetchEnrollments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/enrollments`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel recupero delle iscrizioni');
      }
      setEvent(result.data.event);
      setEnrollments(result.data.enrollments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string, userName: string) => {
    if (!confirm(`Rimuovere l'iscrizione di ${userName}?`)) return;

    try {
      const response = await fetch(`/api/admin/events/${eventId}/enrollments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore durante la rimozione');
      }

      fetchEnrollments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const downloadCSV = () => {
    if (!enrollments.length) return;

    const headers = ['Nome', 'Cognome', 'Email', 'Gruppo Scout', 'Stato', 'Data Iscrizione'];
    const csvRows = [headers.join(',')];

    for (const enrollment of filteredEnrollments) {
      const profile = enrollment.profiles;
      const row = [
        profile?.name || '',
        profile?.surname || '',
        profile?.email || '',
        profile?.scout_group || '',
        getStatusLabel(enrollment.status),
        new Date(enrollment.created_at).toLocaleDateString('it-IT'),
      ].map(value => `"${String(value).replace(/"/g, '""')}"`);
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `iscrizioni_${event?.title?.replace(/\s/g, '_') ?? eventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadXLS = async () => {
    if (!enrollments.length) return;

    try {
      const XLSX = await import('xlsx');

      const data = filteredEnrollments.map(enrollment => ({
        Nome: enrollment.profiles?.name || '',
        Cognome: enrollment.profiles?.surname || '',
        Email: enrollment.profiles?.email || '',
        'Gruppo Scout': enrollment.profiles?.scout_group || '',
        Stato: getStatusLabel(enrollment.status),
        'Data Iscrizione': new Date(enrollment.created_at).toLocaleDateString('it-IT'),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Iscrizioni');
      XLSX.writeFile(wb, `iscrizioni_${event?.title?.replace(/\s/g, '_') ?? eventId}.xlsx`);
    } catch (err) {
      console.error('Errore export XLS:', err);
      alert('Errore durante l\'esportazione XLS. Prova con CSV.');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confermato';
      case 'waitlist': return 'Lista d\'attesa';
      case 'cancelled': return 'Cancellato';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'waitlist': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEnrollments = filterStatus === 'all'
    ? enrollments
    : enrollments.filter(e => e.status === filterStatus);

  const confirmedCount = enrollments.filter(e => e.status === 'confirmed').length;
  const waitlistCount = enrollments.filter(e => e.status === 'waitlist').length;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento iscrizioni...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8">
        <div className="bg-red-100 text-red-700 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Errore</h2>
          <p>{error}</p>
          <Link href="/admin/events" className="text-red-600 hover:underline mt-4 inline-block">
            Torna agli eventi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/events" className="text-agesci-blue hover:underline inline-flex items-center gap-1 mb-4 min-h-[44px]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Torna agli eventi
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Iscrizioni</h1>
        <p className="text-gray-500 mt-1">{event?.title}</p>
      </div>

      {/* Stats - Responsive grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Confermati</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{confirmedCount} / {event?.max_posti}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Lista d&apos;attesa</p>
          <p className="text-lg sm:text-2xl font-bold text-yellow-600">{waitlistCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Totale</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{enrollments.length}</p>
        </div>
      </div>

      {/* Actions - Responsive */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex-1 sm:flex-none px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light active:scale-95 transition-all inline-flex items-center justify-center gap-2 min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi Iscrizione
        </button>
        <button
          onClick={downloadCSV}
          disabled={!enrollments.length}
          className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="hidden sm:inline">Esporta</span> CSV
        </button>
        <button
          onClick={downloadXLS}
          disabled={!enrollments.length}
          className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="hidden sm:inline">Esporta</span> Excel
        </button>
      </div>

      {/* Filter - Touch friendly with scroll */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
          {[
            { value: 'all', label: 'Tutti' },
            { value: 'confirmed', label: 'Confermati' },
            { value: 'waitlist', label: 'Lista d\'attesa' },
            { value: 'cancelled', label: 'Cancellati' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterStatus(option.value)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                filterStatus === option.value
                  ? 'bg-agesci-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filteredEnrollments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>Nessuna iscrizione trovata</p>
        </div>
      ) : (
        <>
          {/* Desktop: Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="table-responsive">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Partecipante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gruppo Scout
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Iscrizione
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEnrollments.map((enrollment) => {
                    const profile = enrollment.profiles;
                    const fullName = [profile?.name, profile?.surname].filter(Boolean).join(' ') || 'N/A';

                    return (
                      <tr key={enrollment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{fullName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {profile?.email || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {profile?.scout_group || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(enrollment.status)}`}>
                            {getStatusLabel(enrollment.status)}
                            {enrollment.status === 'waitlist' && enrollment.waitlist_position && (
                              <span className="ml-1">(#{enrollment.waitlist_position})</span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(enrollment.created_at).toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleRemoveEnrollment(enrollment.id, fullName)}
                            className="p-2 text-red-600 hover:text-red-900 transition-colors"
                            title="Rimuovi iscrizione"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: Card View */}
          <div className="md:hidden space-y-4">
            {filteredEnrollments.map((enrollment) => {
              const profile = enrollment.profiles;
              const fullName = [profile?.name, profile?.surname].filter(Boolean).join(' ') || 'N/A';

              return (
                <div key={enrollment.id} className="data-card">
                  {/* Enrollment Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{fullName}</h3>
                      <p className="text-sm text-gray-500 truncate">{profile?.email || '-'}</p>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(enrollment.status)}`}>
                      {getStatusLabel(enrollment.status)}
                      {enrollment.status === 'waitlist' && enrollment.waitlist_position && (
                        <span className="ml-1">(#{enrollment.waitlist_position})</span>
                      )}
                    </span>
                  </div>

                  {/* Enrollment Details */}
                  <div className="space-y-2 text-sm pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Gruppo Scout</span>
                      <span className="text-gray-900">{profile?.scout_group || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Data Iscrizione</span>
                      <span className="text-gray-900">
                        {new Date(enrollment.created_at).toLocaleDateString('it-IT', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="data-card-actions">
                    <button
                      onClick={() => handleRemoveEnrollment(enrollment.id, fullName)}
                      className="action-btn text-red-600"
                      title="Rimuovi iscrizione"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddEnrollmentModal
          eventId={eventId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchEnrollments();
          }}
        />
      )}
    </div>
  );
}
