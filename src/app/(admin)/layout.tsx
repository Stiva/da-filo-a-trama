'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminSupportPendingBadge from '@/components/chat/AdminSupportPendingBadge';
import UserDropdownMenu from '@/components/UserDropdownMenu';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const adminToolsLinks = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      exact: true,
      badge: false,
    },
    {
      href: '/admin/users',
      label: 'Iscritti APP',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      badge: false,
    },
    {
      href: '/admin/crm',
      label: 'Lista Iscritti BC',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4a2 2 0 00-2-2h-5m-9 18H2a2 2 0 01-2-2v-5a2 2 0 012-2h3m9 9H8M8 20V4a2 2 0 012-2h5m-2 18v-5a2 2 0 012-2h5m-9-9h5" />
        </svg>
      ),
      badge: false,
    },
    {
      href: '/admin/desks',
      label: 'Check-in Desk',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      badge: false,
    },
    {
      href: '/admin/static-groups',
      label: 'Gruppi Statici',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm10 2a3 3 0 110-6 3 3 0 010 6zm-1.5 5.5L21 16m0 0l-3.5 1.5M21 16v5" />
        </svg>
      ),
      badge: false,
    },
  ];

  const mapAndEventsLinks = [
    {
      href: '/admin/poi',
      label: 'POI',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      badge: false,
    },
    {
      href: '/admin/events',
      label: 'Eventi',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      badge: false,
    },
    {
      href: '/admin/assets',
      label: 'Materiali Evento',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      badge: false,
    },
    {
      href: '/admin/map',
      label: 'Gestione Aree',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l6-3 5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17l-6 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7v13M15 4v13" />
        </svg>
      ),
      badge: false,
    },
  ];

  const communicationsLinks = [
    {
      href: '/admin/support',
      label: 'Service Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 6l-3-3V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H8z" />
        </svg>
      ),
      badge: true,
    },
    {
      href: '/admin/push-notifications',
      label: 'Notifiche Push',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      badge: false,
    },
    {
      href: '/admin/content',
      label: 'Avvisi',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      badge: false,
    },
  ];

  const configLinks = [
    {
      href: '/admin/settings',
      label: 'Impostazioni / Colori',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      badge: false,
      activePatterns: ['/admin/settings', '/admin/categories', '/admin/service-roles', '/admin/tags', '/admin/groups'],
    },
  ];

  const isLinkActive = (href: string, exact?: boolean, activePatterns?: string[]) => {
    if (activePatterns) {
      return activePatterns.some(pattern => pathname === pattern || pathname.startsWith(pattern + '/'));
    }
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navbar */}
      <nav className="bg-gray-900 text-white shadow-lg fixed top-0 w-full z-50 h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between h-full">
            {/* Left: Hamburger + Logo */}
            <div className="flex items-center gap-3">
              {/* Hamburger - visible on mobile */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors touch-target"
                aria-label={isSidebarOpen ? 'Chiudi menu' : 'Apri menu'}
              >
                {isSidebarOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              <Link href="/admin" className="font-bold text-xl text-green-400">
                Admin Panel
              </Link>
              <span className="hidden sm:block ml-2 text-gray-400 text-sm">Da Filo a Trama</span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/dashboard"
                className="hidden lg:flex items-center text-gray-300 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors"
              >
                Torna al sito
              </Link>
              <UserDropdownMenu />
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:fixed lg:top-16 inset-y-0 left-0 z-40
            w-64 bg-gray-800 h-[100dvh] lg:h-[calc(100vh-4rem)] text-white
            transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
            pt-16 lg:pt-0 pb-safe
            overflow-y-auto
          `}
        >
          <nav className="p-4 space-y-2">
            <p className="text-xs uppercase text-gray-500 font-semibold mb-4 px-3">
              Admin tools
            </p>

            {adminToolsLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors min-h-[44px]
                  ${isLinkActive(link.href, link.exact, (link as any).activePatterns)
                    ? 'bg-gray-700 text-white'
                    : 'hover:bg-gray-700 active:bg-gray-600 text-gray-300'
                  }
                `}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}

            <p className="text-xs uppercase text-gray-500 font-semibold mt-6 mb-4 px-3">
              Mappa ed Eventi
            </p>

            {mapAndEventsLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors min-h-[44px]
                  ${isLinkActive(link.href, false, (link as any).activePatterns)
                    ? 'bg-gray-700 text-white'
                    : 'hover:bg-gray-700 active:bg-gray-600 text-gray-300'
                  }
                `}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}

            <p className="text-xs uppercase text-gray-500 font-semibold mt-6 mb-4 px-3">
              Comunicazioni
            </p>

            {communicationsLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors min-h-[44px]
                  ${isLinkActive(link.href, false, (link as any).activePatterns)
                    ? 'bg-gray-700 text-white'
                    : 'hover:bg-gray-700 active:bg-gray-600 text-gray-300'
                  }
                `}
              >
                {link.icon}
                <span>{link.label}</span>
                {link.badge && <AdminSupportPendingBadge />}
              </Link>
            ))}

            <p className="text-xs uppercase text-gray-500 font-semibold mt-6 mb-4 px-3">
              Configurazione
            </p>

            {configLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors min-h-[44px]
                  ${isLinkActive(link.href, false, (link as any).activePatterns)
                    ? 'bg-gray-700 text-white'
                    : 'hover:bg-gray-700 active:bg-gray-600 text-gray-300'
                  }
                `}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}

            {/* Mobile-only: Torna al sito */}
            <div className="lg:hidden pt-6 mt-6 border-t border-gray-700">
              <Link
                href="/dashboard"
                onClick={closeSidebar}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 active:bg-gray-600 transition-colors min-h-[44px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                <span>Torna al sito</span>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 lg:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}
