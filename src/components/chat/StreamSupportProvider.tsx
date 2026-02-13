'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StreamChat } from 'stream-chat';

type ChatRole = 'user' | 'staff' | 'admin';

interface ChatSession {
  apiKey: string;
  token: string;
  isAdmin: boolean;
  supportChannelId: string | null;
  user: {
    id: string;
    name: string;
    image?: string;
    role: ChatRole;
  };
}

interface StreamSupportContextValue {
  client: StreamChat | null;
  session: ChatSession | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const StreamSupportContext = createContext<StreamSupportContextValue>({
  client: null,
  session: null,
  loading: true,
  error: null,
  retry: () => {},
});

export const useStreamSupport = (): StreamSupportContextValue => useContext(StreamSupportContext);

export default function StreamSupportProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    let streamClient: StreamChat | null = null;

    const setup = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/chat/session');
        const result = await response.json();

        if (!response.ok || !result?.data) {
          throw new Error(result?.error || 'Impossibile inizializzare la chat');
        }

        const nextSession = result.data as ChatSession;
        streamClient = StreamChat.getInstance(nextSession.apiKey);

        await streamClient.connectUser(
          {
            id: nextSession.user.id,
            name: nextSession.user.name,
            image: nextSession.user.image,
            role: nextSession.user.role,
          },
          nextSession.token
        );

        if (!mounted) return;
        setSession(nextSession);
        setClient(streamClient);
      } catch (err) {
        if (!mounted) return;
        setClient(null);
        setSession(null);
        setError(err instanceof Error ? err.message : 'Errore chat');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (streamClient) {
        void streamClient.disconnectUser();
      }
    };
  }, [reloadKey]);

  const retry = () => {
    setReloadKey((prev) => prev + 1);
  };

  const value = useMemo(
    () => ({
      client,
      session,
      loading,
      error,
      retry,
    }),
    [client, session, loading, error]
  );

  return <StreamSupportContext.Provider value={value}>{children}</StreamSupportContext.Provider>;
}
