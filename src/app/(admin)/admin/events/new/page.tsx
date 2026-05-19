import EventForm from '@/components/EventForm';
import { getCopy, tSync } from '@/lib/cms/copy';

export default async function NewEventPage() {
  const copy = await getCopy();
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nuovo Evento</h1>
        <p className="text-gray-500 mt-1">{tSync(copy, 'admin.events.new.subtitle')}</p>
      </div>

      <EventForm />
    </div>
  );
}
