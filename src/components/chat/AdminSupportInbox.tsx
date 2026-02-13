'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from 'stream-chat-react';
import type { Channel as StreamChannel } from 'stream-chat';
import StreamSupportProvider, { useStreamSupport } from '@/components/chat/StreamSupportProvider';
import 'stream-chat-react/dist/css/v2/index.css';

const AdminSupportInboxInner = () => {
  const { client, session, loading, error } = useStreamSupport();
  const [channels, setChannels] = useState<StreamChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<StreamChannel | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canUse = useMemo(() => {
    if (loading || error || !client || !session) return false;
    return session.isAdmin;
  }, [loading, error, client, session]);

  const refreshChannels = async () => {
    if (!client || !session?.isAdmin) return;

    setIsRefreshing(true);
    try {
      const filters = {
        type: 'messaging',
        support_chat: true,
        support_status: { $in: ['pending', 'active'] },
      } as Record<string, unknown>;

      const result = await client.queryChannels(
        filters,
        { last_message_at: -1 },
        { watch: true, state: true, limit: 30 }
      );
      setChannels(result);
      if (!selectedChannel && result.length > 0) {
        setSelectedChannel(result[0]);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshChannels();
  }, [client, session?.isAdmin]);

  useEffect(() => {
    if (!selectedChannel?.id) return;

    const activateSelectedChannel = async () => {
      await fetch('/api/chat/channel/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: selectedChannel.id }),
      });

      await refreshChannels();
    };

    void activateSelectedChannel();
  }, [selectedChannel?.id]);

  const handleOpenChannel = async (channel: StreamChannel) => {
    setSelectedChannel(channel);
  };

  if (!canUse) {
    if (loading) {
      return <p className="text-gray-500">Caricamento inbox supporto...</p>;
    }
    return <p className="text-red-600">Accesso chat supporto non disponibile.</p>;
  }

  if (!client || !session) {
    return <p className="text-red-600">Client chat non disponibile.</p>;
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 min-h-[70vh]">
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-agesci-blue">Richieste Supporto</h2>
          <button
            type="button"
            onClick={() => void refreshChannels()}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            {isRefreshing ? 'Aggiorno...' : 'Aggiorna'}
          </button>
        </div>

        {channels.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessuna richiesta in coda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {channels.map((channel) => {
              const data = (channel.data || {}) as Record<string, unknown>;
              const status = (data.support_status as string) || 'pending';
              const channelName =
                (data.name as string | undefined) || channel.id || 'Support request';
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenChannel(channel)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                      selectedChannel?.id === channel.id ? 'bg-agesci-blue/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900 line-clamp-1">
                        {channelName}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {status === 'pending' ? 'Pending' : 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">ID: {channel.id}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!selectedChannel ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Seleziona una richiesta per aprire la chat
          </div>
        ) : (
          <Chat client={client}>
            <Channel channel={selectedChannel}>
              <Window>
                <MessageList />
                <MessageInput focus />
              </Window>
              <Thread />
            </Channel>
          </Chat>
        )}
      </section>
    </div>
  );
};

export default function AdminSupportInbox() {
  return (
    <StreamSupportProvider>
      <AdminSupportInboxInner />
    </StreamSupportProvider>
  );
}
