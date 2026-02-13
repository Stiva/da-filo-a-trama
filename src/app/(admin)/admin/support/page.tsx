import AdminSupportInbox from '@/components/chat/AdminSupportInbox';

export default function AdminSupportPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Service Chat</h1>
        <p className="text-gray-600 mt-1">
          Gestisci richieste utenti, apri sessioni e rispondi con allegati.
        </p>
      </header>

      <AdminSupportInbox />
    </div>
  );
}
