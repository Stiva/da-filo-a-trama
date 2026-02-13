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
  const [isMinimized, setIsMinimized] = useState(false);
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
    if (!isOpen || isMinimized || !channel) return;
    void channel.markRead();
    setUnreadCount(0);
  }, [isOpen, isMinimized, channel]);

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
    if (session?.isAdmin) return false;
    if (!session && !error) return false;
    return true;
  }, [loading, error, session]);

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          aria-label="Apri chat assistenza"
          className="fixed bottom-6 right-6 z-[70] relative w-14 h-14 rounded-full bg-agesci-blue text-white shadow-xl hover:bg-agesci-blue-light transition-colors"
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 70 }}
        >
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 font-semibold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <Image
            src="/chat-118.png"
            alt="Apri chat"
            width={32}
            height={32}
            className="mx-auto rounded-full"
          />
        </button>
      )}

      {localNotification && !isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-24 right-6 z-[70] max-w-xs bg-white border border-agesci-blue/30 shadow-lg rounded-xl px-3 py-2 text-left"
          aria-label="Apri chat assistenza per leggere il nuovo messaggio"
          style={{ position: 'fixed', right: 24, bottom: 96, zIndex: 70 }}
        >
          <p className="text-xs font-semibold text-agesci-blue">Nuovo messaggio</p>
          <p className="text-sm text-gray-700 line-clamp-2">{localNotification.text}</p>
        </button>
      )}

      {isOpen && isMinimized && (
        <div
          className="fixed bottom-6 right-6 z-[70] bg-white border border-agesci-blue/20 shadow-xl rounded-xl px-3 py-2 flex items-center gap-2"
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 70 }}
        >
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="text-sm font-semibold text-agesci-blue"
            aria-label="Ripristina chat"
          >
            Chat Assistenza
          </button>
          {unreadCount > 0 && (
            <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 font-semibold text-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsMinimized(false);
            }}
            aria-label="Chiudi chat assistenza"
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {isOpen && !isMinimized && (
        <div
          className="fixed bottom-6 right-6 z-[70] w-[92vw] max-w-md h-[72vh] max-h-[620px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-agesci-blue/20 flex flex-col"
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 70 }}
        >
          <div className="absolute top-2 right-2 z-[95] flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              aria-label="Minimizza chat"
              className="px-2 py-1 text-xs rounded-lg bg-white/90 text-agesci-blue border border-agesci-blue/20 shadow-sm hover:bg-white"
            >
              Riduci
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
              }}
              aria-label="Chiudi chat"
              className="p-1.5 rounded-lg bg-white/90 text-gray-600 border border-gray-200 shadow-sm hover:bg-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="px-4 py-2 rounded-lg bg-agesci-blue text-white hover:bg-agesci-blue-light"
              >
                Riprova
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
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
