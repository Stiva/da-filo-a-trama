'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export default function DashboardAdminBanner() {
  const { isLoaded, user } = useUser();

  if (!isLoaded || !user) return null;

  const role = (user.publicMetadata as { role?: string } | undefined)?.role;
  const isAdmin = role === 'admin' || role === 'staff' || role === 'segreteria';

  if (!isAdmin) return null;

  const isSegreteria = role === 'segreteria';

  return (
    <section className="mb-8">
      <div className="card bg-gradient-to-r from-agesci-blue to-agesci-blue-dark text-white">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <ShieldIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">Pannello Amministrazione</h3>
                <p className="text-white/70 text-sm">
                  {isSegreteria ? 'Gestisci utenti e check-in' : 'Gestisci eventi, utenti e contenuti'}
                </p>
              </div>
            </div>
            <Link
              href={isSegreteria ? '/admin/users' : '/admin'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-agesci-yellow text-agesci-blue rounded-xl font-semibold text-sm hover:bg-agesci-yellow-light transition-colors"
            >
              Vai all&apos;Admin
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {isSegreteria ? (
            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
              <Link
                href="/admin/users"
                className="text-center hover:bg-white/10 rounded-lg py-2 transition-colors"
              >
                <div className="text-2xl font-bold">Utenti</div>
                <div className="text-white/70 text-sm">CRM</div>
              </Link>
              <Link
                href="/admin/desks"
                className="text-center hover:bg-white/10 rounded-lg py-2 transition-colors"
              >
                <div className="text-2xl font-bold">Check-in</div>
                <div className="text-white/70 text-sm">Desk</div>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
              <Link
                href="/admin/events"
                className="text-center hover:bg-white/10 rounded-lg py-2 transition-colors"
              >
                <div className="text-2xl font-bold">Eventi</div>
                <div className="text-white/70 text-sm">Gestione</div>
              </Link>
              <Link
                href="/admin/users"
                className="text-center hover:bg-white/10 rounded-lg py-2 transition-colors"
              >
                <div className="text-2xl font-bold">Utenti</div>
                <div className="text-white/70 text-sm">CRM</div>
              </Link>
              <Link
                href="/admin/content"
                className="text-center hover:bg-white/10 rounded-lg py-2 transition-colors"
              >
                <div className="text-2xl font-bold">Contenuti</div>
                <div className="text-white/70 text-sm">Editor</div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
