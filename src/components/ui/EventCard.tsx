'use client';

import Link from 'next/link';
import type { Event } from '@/types/database';
import Badge from './Badge';

interface EventCardProps {
  event: Event;
  showEnrollButton?: boolean;
  isEnrolled?: boolean;
  onEnroll?: () => void;
  enrolling?: boolean;
  enrollmentCount?: number;
}

// Icone decorative per angolo
const categoryIcons: Record<string, string> = {
  workshop: '🎨',
  conference: '🎤',
  outdoor: '🏕️',
  spiritual: '🙏',
  game: '🎮',
  default: '⭐',
};

export default function EventCard({
  event,
  showEnrollButton = false,
  isEnrolled = false,
  onEnroll,
  enrolling = false,
  enrollmentCount = 0,
}: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const spotsLeft = event.max_posti > 0
    ? event.max_posti - enrollmentCount
    : null;

  const icon = event.tags?.[0]
    ? categoryIcons[event.tags[0]] || categoryIcons.default
    : categoryIcons.default;

  return (
    <div className="card-hover group relative overflow-hidden active:scale-[0.99] transition-transform">
      {/* Icona decorativa angolo */}
      <div className="absolute -top-2 -right-2 w-16 h-16 bg-agesci-yellow rounded-full flex items-center justify-center text-2xl transform rotate-12 group-hover:rotate-0 group-active:rotate-0 transition-transform duration-300 shadow-md">
        {icon}
      </div>

      <div className="card-body pt-8">
        {/* Data */}
        <div className="flex items-center gap-2 text-sm text-agesci-blue/70 mb-2">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="truncate">{formatDate(event.start_time)}</span>
        </div>

        {/* Titolo */}
        <h3 className="font-display text-xl font-bold text-agesci-blue mb-2 line-clamp-2 group-hover:text-agesci-blue-light group-active:text-agesci-blue-light transition-colors">
          {event.title}
        </h3>

        {/* Descrizione */}
        {event.description && (
          <p className="text-agesci-blue/70 text-sm mb-4 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Location */}
        {event.poi?.nome && (
          <div className="flex items-center gap-2 text-sm text-agesci-blue/60 mb-3">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="truncate">{event.poi.nome}</span>
          </div>
        )}

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {event.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="blue" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-agesci-blue/10">
          {/* Posti disponibili */}
          {spotsLeft !== null && (
            <div
              className={`text-sm font-medium ${
                spotsLeft <= 5
                  ? 'text-red-600'
                  : spotsLeft <= 10
                  ? 'text-orange-600'
                  : 'text-lc-green'
              }`}
            >
              {spotsLeft > 0 ? `${spotsLeft} posti disponibili` : 'Tutto esaurito'}
            </div>
          )}

          {/* Azioni - Touch friendly with larger gap */}
          <div className="flex gap-3 sm:ml-auto">
            {showEnrollButton && !isEnrolled && spotsLeft !== 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEnroll?.();
                }}
                disabled={enrolling}
                className="btn-primary btn-sm flex-1 sm:flex-none"
              >
                {enrolling ? 'Iscrizione...' : 'Iscriviti'}
              </button>
            )}
            {isEnrolled && (
              <span className="badge-green inline-flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Iscritto
              </span>
            )}
            <Link
              href={`/events/${event.id}`}
              onClick={(e) => e.stopPropagation()}
              className="btn-outline btn-sm group/link flex-1 sm:flex-none justify-center"
            >
              Dettagli
              <svg
                className="w-4 h-4 transform group-hover/link:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
