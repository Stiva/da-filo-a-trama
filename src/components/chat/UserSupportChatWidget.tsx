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

interface LocalNotification {
  id: number;
  text: string;
}

const UserSupportChatWidgetInner = () => {
  const { client, session, loading, error } = useStreamSupport();
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [localNotification, setLocalNotification] = useState<LocalNotification | null>(null);

  useEffect(() => {
    if (!client || !session?.supportChannelId || session.isAdmin) return;

    const nextChannel = client.channel('messaging', session.supportChannelId);
    void nextChannel.watch().then(() => {
      setChannel(nextChannel);
      setUnreadCount(nextChannel.countUnread() || 0);
    });

    const handleEvent = () => {
      setUnreadCount(nextChannel.countUnread() || 0);
    };

    const handleNewMessage = (event: { user?: { id?: string }; message?: { text?: string } }) => {
      const senderId = event.user?.id;
      if (!senderId || senderId === session.user.id) return;

      const messageText = event.message?.text?.trim() || 'Nuovo messaggio in chat assistenza';
      setLocalNotification({ id: Date.now(), text: messageText });

      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Nuovo messaggio da assistenza', {
            body: messageText,
          });
        }
      }
    };

    const subscription = nextChannel.on('message.new', (event) => {
      handleEvent();
      handleNewMessage(event as { user?: { id?: string }; message?: { text?: string } });
    });
    const readSubscription = nextChannel.on('message.read', handleEvent);

    return () => {
      subscription.unsubscribe();
      readSubscription.unsubscribe();
    };
  }, [client, session]);

  useEffect(() => {
    if (!isOpen || !channel) return;
    void channel.markRead();
    setUnreadCount(0);
  }, [isOpen, channel]);

  useEffect(() => {
    if (!localNotification) return;

    const timeout = window.setTimeout(() => {
      setLocalNotification(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [localNotification]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  const shouldRender = useMemo(() => {
    if (loading) return false;
    if (error) return false;
    if (!session) return false;
    if (session.isAdmin) return false;
    return true;
  }, [loading, error, session]);

  if (!shouldRender || !client || !channel) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Apri chat assistenza"
          className="fixed bottom-6 right-6 z-[70] relative w-14 h-14 rounded-full bg-agesci-blue text-white shadow-xl hover:bg-agesci-blue-light transition-colors"
        >
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 font-semibold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <svg className="w-7 h-7 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m9 6l-3.464-3.464A9 9 0 1118 3a9 9 0 013.536 17z" />
          </svg>
        </button>
      )}

      {localNotification && !isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 z-[70] max-w-xs bg-white border border-agesci-blue/30 shadow-lg rounded-xl px-3 py-2 text-left"
          aria-label="Apri chat assistenza per leggere il nuovo messaggio"
        >
          <p className="text-xs font-semibold text-agesci-blue">Nuovo messaggio</p>
          <p className="text-sm text-gray-700 line-clamp-2">{localNotification.text}</p>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[70] w-[92vw] max-w-md h-[72vh] max-h-[620px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-agesci-blue/20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-agesci-blue text-white">
            <h3 className="font-semibold">Chat Assistenza</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Chiudi chat"
              className="p-1.5 rounded-lg hover:bg-white/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <Chat client={client}>
            <Channel channel={channel}>
              <Window>
                <MessageList />
                <MessageInput focus />
              </Window>
              <Thread />
            </Channel>
          </Chat>
        </div>
      )}
    </>
  );
};

export default function UserSupportChatWidget() {
  return (
    <StreamSupportProvider>
      <UserSupportChatWidgetInner />
    </StreamSupportProvider>
  );
}
