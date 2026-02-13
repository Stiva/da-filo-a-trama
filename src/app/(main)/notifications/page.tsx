'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Notification } from '@/types/database';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setNotifications(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore aggiornamento');
      }

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          read_at: notification.read_at || new Date().toISOString(),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const markRead = async (id: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore aggiornamento');
      }

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id
            ? { ...notification, read_at: notification.read_at || new Date().toISOString() }
            : notification
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-gray-900">Notifiche</h1>
            <p className="text-gray-500 mt-1">
              {unreadCount > 0
                ? `${unreadCount} non lette`
                : 'Tutte le notifiche sono state lette'}
            </p>
          </div>
          <button
            onClick={markAllRead}
            disabled={notifications.length === 0 || unreadCount === 0}
            className="px-4 py-2.5 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light disabled:opacity-50 min-h-[44px]"
          >
            Segna tutte come lette
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Caricamento notifiche...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            <p>Nessuna notifica al momento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.action_url || '/notifications'}
                onClick={() => {
                  if (!notification.read_at) {
                    void markRead(notification.id);
                  }
                }}
                className={`block rounded-lg border p-4 transition-colors ${
                  notification.read_at
                    ? 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-agesci-yellow/10 border-agesci-yellow/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">{notification.title}</p>
                    <p className="text-gray-600 mt-1">{notification.body}</p>
                  </div>
                  {!notification.read_at && (
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-agesci-blue"></span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(notification.created_at).toLocaleString('it-IT')}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
