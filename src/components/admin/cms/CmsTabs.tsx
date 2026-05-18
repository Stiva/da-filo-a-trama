'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/admin/cms', label: 'Panoramica', exact: true },
  { href: '/admin/cms/copy', label: 'Copy' },
  { href: '/admin/cms/brand', label: 'Brand' },
  { href: '/admin/cms/fonts', label: 'Font' },
  { href: '/admin/cms/metadata', label: 'Metadata' },
  { href: '/admin/cms/pages', label: 'Pagine' },
];

export default function CmsTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200 mb-6 sm:mb-8 overflow-x-auto">
      <nav className="-mb-px flex space-x-6 min-w-max" aria-label="CMS Tabs">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-agesci-blue text-agesci-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
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
