import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Event, EventCategory } from '@/types/database';
import { format, parseISO, isSameDay, startOfDay, addDays, subDays, differenceInMinutes } from 'date-fns';
import { it } from 'date-fns/locale';

interface MultiDayCalendarViewProps {
    events: any[]; // Use any to allow both Event and EventWithEnrollment/EventListItem
    isAdmin?: boolean;
    onToggleFavourite?: (eventId: string, e: React.MouseEvent) => void;
    onToggleSubscribe?: (eventId: string, isEnrolled: boolean, e: React.MouseEvent) => void;
}

export default function DailyCalendarView({
    events,
    isAdmin = true,
    onToggleFavourite,
    onToggleSubscribe
}: MultiDayCalendarViewProps) {
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [events]);

    const firstEventDate = sortedEvents.length > 0 ? parseISO(sortedEvents[0].start_time) : new Date();
    const [startDate, setStartDate] = useState<Date>(startOfDay(firstEventDate));

    const DAYS_TO_SHOW = 3;
    const MIN_HOUR = 8;
    const MAX_HOUR = 24;
    const HOUR_HEIGHT = 72; // px per hour

    const days = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(startDate, i));

    const handlePrev = () => setStartDate(subDays(startDate, DAYS_TO_SHOW));
    const handleNext = () => setStartDate(addDays(startDate, DAYS_TO_SHOW));

    const getCategoryColor = (cat: EventCategory) => {
        const colors: Record<EventCategory, string> = {
            workshop: 'bg-blue-100 text-blue-800 border-blue-300',
            conferenza: 'bg-purple-100 text-purple-800 border-purple-300',
            laboratorio: 'bg-green-100 text-green-800 border-green-300',
            gioco: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            spiritualita: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            servizio: 'bg-orange-100 text-orange-800 border-orange-300',
            natura: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            arte: 'bg-pink-100 text-pink-800 border-pink-300',
            musica: 'bg-rose-100 text-rose-800 border-rose-300',
            altro: 'bg-gray-100 text-gray-800 border-gray-300',
        };
        return colors[cat] || colors.altro;
    };

    const hours = Array.from({ length: MAX_HOUR - MIN_HOUR + 1 }, (_, i) => i + MIN_HOUR);
    const totalHeight = hours.length * HOUR_HEIGHT;

    const getEventsForDay = (day: Date) => sortedEvents.filter(e => isSameDay(parseISO(e.start_time), day));

    const renderEventBlock = (event: any, dayEvents: any[]) => {
        const start = parseISO(event.start_time);
        const end = parseISO(event.end_time);

        const startHourNum = start.getHours() + (start.getMinutes() / 60);
        let topOffset = (startHourNum - MIN_HOUR) * HOUR_HEIGHT;
        if (topOffset < 0) topOffset = 0;

        const durationMinutes = differenceInMinutes(end, start);
        let height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 28);

        if (startHourNum < MIN_HOUR) {
            const clampedDuration = durationMinutes - ((MIN_HOUR - startHourNum) * 60);
            height = Math.max((clampedDuration / 60) * HOUR_HEIGHT, 28);
        }

        // Overlap handling
        const overlapping = dayEvents.filter(e => {
            const s = parseISO(e.start_time);
            const eEnd = parseISO(e.end_time);
            return s < end && eEnd > start;
        });
        const idx = overlapping.findIndex(e => e.id === event.id);
        const colWidth = 100 / overlapping.length;
        const colLeft = colWidth * idx;

        const linkHref = isAdmin ? `/admin/events/${event.id}` : (event.is_placeholder ? '#' : `/events/${event.id}`);
        const isFavourited = event.is_favourited;
        const isEnrolled = event.is_enrolled;
        const isFull = event.max_posti && event.enrollment_count >= event.max_posti;
        const isPlaceholder = event.is_placeholder === true;

        const baseClasses = `absolute rounded-md border p-1.5 shadow-sm flex flex-col overflow-hidden transition-all`;
        
        let styleClasses = '';
        if (isPlaceholder) {
            styleClasses = `bg-gray-100 border-gray-400 border-dashed text-gray-600 opacity-80`; // Placeholder styling
        } else {
            styleClasses = `hover:z-30 hover:shadow-lg ${getCategoryColor(event.category)}`; // Normal styling
        }

        return (
            <div
                key={event.id}
                className={`${baseClasses} ${styleClasses}`}
                style={{
                    top: `${topOffset}px`,
                    height: `${height}px`,
                    width: `calc(${colWidth}% - 8px)`,
                    left: `calc(${colLeft}% + 4px)`,
                }}
                title={`${event.title} (${format(start, 'HH:mm')} - ${format(end, 'HH:mm')})`}
            >
                <div className="flex justify-between items-start gap-1">
                    {isPlaceholder ? (
                        <span className="font-semibold text-xs leading-tight line-clamp-2 flex-1">
                            {event.title}
                        </span>
                    ) : (
                        <Link href={linkHref} className="font-semibold text-xs leading-tight line-clamp-2 hover:underline flex-1">
                            {event.title}
                        </Link>
                    )}
                    
                    {/* Action Buttons for Users (Hidden for placeholders) */}
                    {!isAdmin && !isPlaceholder && (onToggleFavourite || onToggleSubscribe) && height > 40 && colWidth > 30 && (
                        <div className="flex items-center gap-1 flex-shrink-0 bg-white/50 rounded-md px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                            {onToggleFavourite && (
                                <button
                                    onClick={(e) => onToggleFavourite(event.id, e)}
                                    className="p-0.5 rounded-full hover:bg-white transition-colors"
                                    title={isFavourited ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                                    aria-label={isFavourited ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                                >
                                    <svg className={`w-3.5 h-3.5 ${isFavourited ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400 fill-none'}`} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                    </svg>
                                </button>
                            )}
                            {onToggleSubscribe && (
                                <button
                                    onClick={(e) => onToggleSubscribe(event.id, isEnrolled, e)}
                                    className={`p-0.5 rounded-full hover:bg-white transition-colors ${isEnrolled ? 'text-red-500' : (isFull ? 'text-yellow-600' : 'text-green-600')}`}
                                    title={isEnrolled ? 'Annulla iscrizione' : (isFull ? 'Iscriviti alla lista d\'attesa' : 'Iscriviti')}
                                    aria-label={isEnrolled ? 'Annulla iscrizione' : (isFull ? 'Iscriviti alla lista d\'attesa' : 'Iscriviti')}
                                >
                                    {isEnrolled ? (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <span className="text-[10px] opacity-80 mt-0.5 font-medium flex items-center gap-1">
                    {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                    {!isAdmin && isEnrolled && (
                        <span className="px-1 py-0.5 bg-green-500 text-white rounded-[4px] text-[8px] leading-none uppercase font-bold tracking-wide">
                            Iscritto
                        </span>
                    )}
                </span>
                
                {height > 50 && event.speaker_name && (
                    <span className="text-[10px] mt-auto truncate opacity-70">
                        {event.speaker_name}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-md flex flex-col" style={{ height: '800px' }}>
            {/* Header with navigation and day labels */}
            <div className="border-b flex-shrink-0">
                {/* Navigation row */}
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={handlePrev}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Giorni precedenti"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 capitalize">
                        {format(days[0], 'd MMM', { locale: it })} – {format(days[DAYS_TO_SHOW - 1], 'd MMM yyyy', { locale: it })}
                    </h2>
                    <button
                        onClick={handleNext}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Giorni successivi"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Day column headers */}
                <div className="flex border-t">
                    <div className="w-16 sm:w-20 flex-shrink-0" /> {/* spacer for time axis */}
                    {days.map((day, i) => {
                        const eventCount = getEventsForDay(day).length;
                        return (
                            <div
                                key={i}
                                className={`flex-1 text-center py-2 border-l ${isSameDay(day, new Date()) ? 'bg-blue-50' : 'bg-gray-50'}`}
                            >
                                <div className="text-xs text-gray-500 uppercase">{format(day, 'EEE', { locale: it })}</div>
                                <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-900'}`}>
                                    {format(day, 'd')}
                                </div>
                                {eventCount > 0 && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">{eventCount} eventi</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-y-auto overflow-x-auto">
                <div className="flex relative" style={{ minHeight: `${totalHeight}px` }}>
                    {/* Time axis */}
                    <div className="w-16 sm:w-20 border-r flex-shrink-0 bg-gray-50 sticky left-0 z-10">
                        {hours.map((hour) => (
                            <div
                                key={`time-${hour}`}
                                className="relative pr-2 flex items-start justify-end text-[11px] text-gray-400 font-medium"
                                style={{ height: `${HOUR_HEIGHT}px` }}
                            >
                                <span className="absolute -top-2 bg-gray-50 px-1">{String(hour).padStart(2, '0')}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {days.map((day, dayIdx) => {
                        const dayEvents = getEventsForDay(day);
                        return (
                            <div
                                key={dayIdx}
                                className={`flex-1 relative border-l min-w-[180px] ${isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''}`}
                            >
                                {/* Horizontal grid lines */}
                                {hours.map((hour) => (
                                    <div
                                        key={`grid-${dayIdx}-${hour}`}
                                        className="absolute w-full border-t border-gray-100 pointer-events-none"
                                        style={{ top: `${(hour - MIN_HOUR) * HOUR_HEIGHT}px` }}
                                    />
                                ))}

                                {/* Events */}
                                {dayEvents.map(event => renderEventBlock(event, dayEvents))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
