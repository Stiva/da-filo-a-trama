import EventForm from '@/components/EventForm';

export default function NewEventPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nuovo Evento</h1>
        <p className="text-gray-500 mt-1">Crea un nuovo evento per Da Filo a Trama</p>
      </div>

      <EventForm />
    </div>
  );
}
