'use client';

import { useEffect, useState } from 'react';

export default function ChatToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings?key=service_chat_enabled')
      .then(r => r.json())
      .then(result => {
        const val = result.data?.value;
        setEnabled(val === true || val === 'true');
      })
      .catch(() => setEnabled(true));
  }, []);

  const toggle = async () => {
    if (saving || enabled === null) return;
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'service_chat_enabled',
          value: next,
          description: "Abilita/disabilita la service chat per gli utenti dell'app",
        }),
      });
      if (res.ok) setEnabled(next);
    } finally {
      setSaving(false);
    }
  };

  if (enabled === null) return null;

  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">Chat abilitata per gli utenti</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {enabled
            ? 'Gli utenti possono aprire la chat assistenza'
            : 'La chat è nascosta a tutti gli utenti'}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-checked={enabled}
        role="switch"
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:ring-offset-2 disabled:opacity-50 ${
          enabled ? 'bg-agesci-blue' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
