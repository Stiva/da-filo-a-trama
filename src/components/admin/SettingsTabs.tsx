'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsTabs() {
  const pathname = usePathname();

  const tabs = [
    { href: '/admin/categories', label: 'Categorie' },
    { href: '/admin/service-roles', label: 'Ruoli di Servizio' },
    { href: '/admin/tags', label: 'Tags' },
    { href: '/admin/groups', label: 'Gruppi' },
    { href: '/admin/sponsors', label: 'Patrocinatori' },
    { href: '/admin/settings', label: 'Impostazioni App' },
  ];

  return (
    <div className="border-b border-gray-200 mb-6 sm:mb-8 overflow-x-auto">
      <nav className="-mb-px flex space-x-6 min-w-max" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${isActive
                  ? 'border-agesci-blue text-agesci-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
