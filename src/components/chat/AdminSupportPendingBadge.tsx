'use client';

import { useEffect, useState } from 'react';
import { StreamChat } from 'stream-chat';

export default function AdminSupportPendingBadge() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let streamClient: StreamChat | null = null;

    const loadPending = async () => {
      try {
        const response = await fetch('/api/chat/session');
        const result = await response.json();

        if (!response.ok || !result?.data?.isAdmin) return;

        const session = result.data as {
          apiKey: string;
          token: string;
          user: { id: string; name: string; image?: string; role: string };
        };

        streamClient = StreamChat.getInstance(session.apiKey);
        await streamClient.connectUser(
          {
            id: session.user.id,
            name: session.user.name,
            image: session.user.image,
            role: session.user.role,
          },
          session.token
        );

        const channels = await streamClient.queryChannels(
          {
            type: 'messaging',
            support_chat: true,
            support_status: 'pending',
          } as Record<string, unknown>,
          { last_message_at: -1 },
          { limit: 30, watch: true, state: true }
        );

        if (mounted) {
          setPendingCount(channels.length);
        }
      } catch {
        if (mounted) {
          setPendingCount(0);
        }
      }
    };

    loadPending();

    return () => {
      mounted = false;
      if (streamClient) {
        void streamClient.disconnectUser();
      }
    };
  }, []);

  if (pendingCount <= 0) return null;

  return (
    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-gray-900 font-semibold">
      {pendingCount}
    </span>
  );
}
