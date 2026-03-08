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
  const [searchQuery, setSearchQuery] = useState('');
  const [showPastChats, setShowPastChats] = useState(false);

  const canUse = useMemo(() => {
    if (loading || error || !client || !session) return false;
    return session.isAdmin;
  }, [loading, error, client, session]);

  const refreshChannels = async () => {
    if (!client || !session?.isAdmin) return;

    setIsRefreshing(true);
    try {
      const filters: Record<string, unknown> = {
        type: 'messaging',
        support_chat: true,
      };

      if (searchQuery.trim()) {
        filters.name = { $autocomplete: searchQuery.trim() };
      }

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
    const timeoutId = setTimeout(() => {
      void refreshChannels();
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [client, session?.isAdmin, searchQuery]);

  const isChannelActive = (channel: StreamChannel) => {
    const lastActivity = (channel.state?.last_message_at || channel.data?.created_at) as string | Date | undefined;
    if (!lastActivity) return false;
    return (Date.now() - new Date(lastActivity).getTime()) < 30 * 60 * 1000;
  };

  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      if (!showPastChats && !isChannelActive(channel)) return false;
      return true;
    });
  }, [channels, showPastChats]);

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
        <div className="px-4 py-3 border-b border-gray-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-agesci-blue">Richieste Supporto</h2>
            <button
              type="button"
              onClick={() => void refreshChannels()}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              {isRefreshing ? 'Aggiorno...' : 'Aggiorna'}
            </button>
          </div>

          <input
            type="text"
            placeholder="Cerca utente per nome..."
            className="input w-full text-sm py-1.5"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showPastChats}
              onChange={(e) => setShowPastChats(e.target.checked)}
              className="rounded text-agesci-blue focus:ring-agesci-blue"
            />
            Mostra chat passate ({'>'}30 min)
          </label>
        </div>

        {filteredChannels.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessuna richiesta trovata.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {filteredChannels.map((channel) => {
              const data = (channel.data || {}) as Record<string, unknown>;
              const isActive = isChannelActive(channel);
              const channelName =
                (data.name as string | undefined) || channel.id || 'Support request';
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenChannel(channel)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedChannel?.id === channel.id ? 'bg-agesci-blue/5 border-l-2 border-agesci-blue' : 'border-l-2 border-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900 line-clamp-1">
                        {channelName.replace('Supporto · ', '')}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                          }`}
                      >
                        {isActive ? 'Attiva' : 'Scaduta'}
                      </span>
                    </div>
                    {channel.id && (
                      <p className="text-xs text-gray-400 mt-1 uppercase">
                        ID: {channel.id.split('_').slice(1, 3).join('_')}
                      </p>
                    )}
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
