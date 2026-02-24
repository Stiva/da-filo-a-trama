'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Channel,
  ChannelHeader,
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
  const { client, session, loading, error, retry } = useStreamSupport();
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [localNotification, setLocalNotification] = useState<LocalNotification | null>(null);

  useEffect(() => {
    // Note: We no longer restrict admins from seeing the chat widget on the frontend.
    // Admins can use the chat here or in the admin panel.
    if (!client || !session?.supportChannelId) return;

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
    if (!session && !error) return false;
    return true;
  }, [loading, error, session]);

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (Bubble) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Apri chat assistenza"
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[70] w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-agesci-blue text-white shadow-xl hover:bg-agesci-blue-light hover:scale-105 active:scale-95 transition-all flex items-center justify-center p-0 border-0"
        >
          <span className="relative flex items-center justify-center w-full h-full">
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 font-semibold shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <Image
              src="/chat-yw.png"
              alt="Apri chat"
              width={36}
              height={36}
              className="rounded-full w-9 h-9 sm:w-10 sm:h-10 object-contain"
            />
          </span>
        </button>
      )}

      {/* Local Notification Toast */}
      {localNotification && !isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 sm:bottom-28 sm:right-8 z-[70] max-w-[calc(100vw-3rem)] sm:max-w-xs bg-white border border-agesci-blue/30 shadow-lg rounded-xl px-4 py-3 text-left hover:shadow-xl transition-shadow"
          aria-label="Apri chat assistenza per leggere il nuovo messaggio"
        >
          <p className="text-xs font-semibold text-agesci-blue mb-1">Nuovo messaggio</p>
          <p className="text-sm text-gray-700 line-clamp-2">{localNotification.text}</p>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`
            fixed z-[70] bg-white overflow-hidden flex flex-col shadow-2xl
            /* Mobile layout: almost full screen to prevent keyboard issues, curved top */
            inset-x-0 bottom-0 top-[10vh] rounded-t-2xl sm:inset-auto
            /* Desktop/Tablet layout: fixed window in bottom right */
            sm:bottom-8 sm:right-8 sm:w-[400px] sm:h-[650px] sm:max-h-[85vh] sm:rounded-2xl sm:border sm:border-agesci-blue/20
          `}
        >
          {/* Custom Header injected over Stream UI to provide close button */}
          <div className="absolute top-2 right-2 z-[95] flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Chiudi chat"
              className="p-2 sm:p-1.5 rounded-full bg-white/90 text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 transition-all touch-target"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!client || !channel ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6">
              <p className="text-sm text-gray-700 mb-3">La chat non è disponibile in questo momento.</p>
              {error && (
                <p className="text-xs text-red-600 mb-4 max-w-[280px] line-clamp-3">{error}</p>
              )}
              <button
                type="button"
                onClick={retry}
                className="btn btn-primary btn-sm"
              >
                Riprova
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 relative bg-white">
              <Chat client={client}>
                <Channel channel={channel}>
                  <Window>
                    <ChannelHeader />
                    <MessageList />
                    <MessageInput focus />
                  </Window>
                  <Thread />
                </Channel>
              </Chat>
            </div>
          )}
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
