import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Event, EventCategory } from '@/types/database';
import { format, parseISO, isSameDay, startOfDay, addDays, subDays, differenceInMinutes } from 'date-fns';
import { it } from 'date-fns/locale';

interface DailyCalendarViewProps {
    events: Event[];
}

export default function DailyCalendarView({ events }: DailyCalendarViewProps) {
    // Sort events by start date
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [events]);

    // Find the first date with an event, default to today
    const firstEventDate = sortedEvents.length > 0 ? parseISO(sortedEvents[0].start_time) : new Date();
    const [currentDate, setCurrentDate] = useState<Date>(startOfDay(firstEventDate));

    // Determine the start and end hour for the calendar based on events of the day
    // Default bounds 08:00 - 20:00 if no events
    const dailyEvents = useMemo(() => {
        return sortedEvents.filter(e => isSameDay(parseISO(e.start_time), currentDate));
    }, [sortedEvents, currentDate]);

    const MIN_HOUR = 8;
    const MAX_HOUR = 24; // midnight
    const HOUR_HEIGHT = 80; // px per hour

    const handlePrevDay = () => setCurrentDate(subDays(currentDate, 1));
    const handleNextDay = () => setCurrentDate(addDays(currentDate, 1));

    const getCategoryColor = (cat: EventCategory) => {
        const colors: Record<EventCategory, string> = {
            workshop: 'bg-blue-100 text-blue-800 border-blue-200',
            conferenza: 'bg-purple-100 text-purple-800 border-purple-200',
            laboratorio: 'bg-green-100 text-green-800 border-green-200',
            gioco: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            spiritualita: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            servizio: 'bg-orange-100 text-orange-800 border-orange-200',
            natura: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            arte: 'bg-pink-100 text-pink-800 border-pink-200',
            musica: 'bg-rose-100 text-rose-800 border-rose-200',
            altro: 'bg-gray-100 text-gray-800 border-gray-200',
        };
        return colors[cat] || colors.altro;
    };

    const hours = Array.from({ length: MAX_HOUR - MIN_HOUR + 1 }, (_, i) => i + MIN_HOUR);

    return (
        <div className="bg-white rounded-lg shadow-md flex flex-col h-[800px]">
            {/* Calendar Header Controls */}
            <div className="p-4 border-b flex items-center justify-between">
                <button
                    onClick={handlePrevDay}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-gray-900 capitalize">
                    {format(currentDate, 'EEEE d MMMM yyyy', { locale: it })}
                </h2>
                <button
                    onClick={handleNextDay}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-y-auto relative">
                <div className="flex relative min-h-full min-w-[700px]">
                    {/* Time axis */}
                    <div className="w-20 border-r flex flex-col border-gray-100 bg-gray-50 flex-shrink-0 z-10 sticky left-0">
                        {hours.map((hour) => (
                            <div
                                key={`time-${hour}`}
                                className="relative pr-2 flex items-start justify-end text-xs text-gray-500"
                                style={{ height: `${HOUR_HEIGHT}px` }}
                            >
                                <span className="absolute -top-2.5 bg-gray-50 px-1">{hour}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Events Area */}
                    <div className="flex-1 relative border-gray-100 min-w-0 pb-10">
                        {/* Grid lines */}
                        {hours.map((hour) => (
                            <div
                                key={`grid-${hour}`}
                                className="absolute w-full border-t border-gray-100 pointer-events-none"
                                style={{ top: `${(hour - MIN_HOUR) * HOUR_HEIGHT}px` }}
                            />
                        ))}

                        {/* Events */}
                        {dailyEvents.map((event, index) => {
                            const start = parseISO(event.start_time);
                            const end = parseISO(event.end_time);

                            // Calculate top offset
                            const startHourNum = start.getHours() + (start.getMinutes() / 60);
                            let topOffset = (startHourNum - MIN_HOUR) * HOUR_HEIGHT;

                            // Clamp to bounds
                            if (topOffset < 0) topOffset = 0;

                            // Calculate height
                            const durationMinutes = differenceInMinutes(end, start);
                            let height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 30); // At least 30px height

                            // If event starts before MIN_HOUR, adjust its height/top
                            if (startHourNum < MIN_HOUR) {
                                const hiddenMinutes = differenceInMinutes(
                                    new Date(start).setHours(MIN_HOUR, 0, 0, 0),
                                    start
                                );
                                height = Math.max(((durationMinutes - hiddenMinutes) / 60) * HOUR_HEIGHT, 30);
                            }

                            // Simple collision handling: if multiple events overlap, spread them horizontally
                            // This is a naive approach; an advanced one would build columns.
                            // For now, we'll assume they stack over each other or we can give them some width
                            const overlappingEvents = dailyEvents.filter(e => {
                                const s = parseISO(e.start_time);
                                const eEnd = parseISO(e.end_time);
                                return (s < end && eEnd > start);
                            });

                            // Very naive width setting based on collisions
                            const indexInOverlap = overlappingEvents.findIndex(e => e.id === event.id);
                            const width = 100 / overlappingEvents.length;
                            const left = width * indexInOverlap;

                            return (
                                <div
                                    key={event.id}
                                    className={`absolute rounded-md border p-2 shadow-sm flex flex-col overflow-hidden transition-all hover:z-20 hover:shadow-md ${getCategoryColor(event.category)}`}
                                    style={{
                                        top: `${topOffset}px`,
                                        height: `${height}px`,
                                        width: `calc(${width}% - 12px)`,
                                        left: `calc(${left}% + 6px)`,
                                    }}
                                    title={`${event.title} (${format(start, 'HH:mm')} - ${format(end, 'HH:mm')})`}
                                >
                                    <Link href={`/admin/events/${event.id}`} className="font-bold text-sm truncate hover:underline">
                                        {event.title}
                                    </Link>
                                    <div className="text-xs opacity-80 mt-1 font-medium">
                                        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                    </div>
                                    {event.speaker_name && (
                                        <div className="text-xs mt-auto truncate hidden sm:block">
                                            {event.speaker_name}
                                        </div>
                                    )}
                                    <div className="text-xs truncate font-medium uppercase opacity-75 hidden sm:block">
                                        {event.category}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
