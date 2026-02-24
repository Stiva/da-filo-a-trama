'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import AvatarPreview from '@/components/AvatarPreview';

// Profilo removed — accessible via avatar dropdown
const navLinks = [
  { href: '/events', label: 'Eventi', icon: CalendarIcon },
  { href: '/documents', label: 'Documenti', icon: DocumentIcon },
  { href: '/map', label: 'Mappa', icon: MapIcon },
  { href: '/my-events', label: 'I Miei Eventi', icon: StarIcon },
  { href: '/notifications', label: 'Notifiche', icon: BellIcon },
];

interface ProfileData {
  profile_image_url?: string | null;
  avatar_config?: Record<string, unknown> | null;
  name?: string | null;
  surname?: string | null;
}

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profiles');
        const result = await response.json();
        if (response.ok) {
          setProfile(result?.data ?? null);
        }
      } catch {
        // silent
      }
    };
    fetchProfile();
  }, []);

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    if (isAvatarMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarMenuOpen]);

  // The app profile photo; deliberately NOT falling back to Clerk's imageUrl
  const appProfileImageUrl = profile?.profile_image_url ?? null;
  const hasAvatarConfig = !!profile?.avatar_config;

  // Display name
  const displayName =
    [profile?.name, profile?.surname].filter(Boolean).join(' ') ||
    user?.firstName ||
    user?.username ||
    'Utente';

  const avatarFallbackLetter =
    user?.firstName?.charAt(0)?.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    'U';

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    setIsAvatarMenuOpen(false);
    setIsMobileMenuOpen(false);
    await signOut();
    router.push('/');
  };

  /** Renders the avatar circle content */
  const AvatarCircle = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const dim = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
    if (appProfileImageUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={appProfileImageUrl}
          alt="Avatar utente"
          className={`${dim} rounded-full object-cover`}
        />
      );
    }
    if (hasAvatarConfig) {
      return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <AvatarPreview
          config={profile!.avatar_config as any}
          size="full"
          className="border-none !shadow-none w-full h-full"
        />
      );
    }
    return (
      <span className="text-sm font-semibold text-agesci-blue">{avatarFallbackLetter}</span>
    );
  };

  return (
    <>
      <nav className="bg-scout-cream border-b-3 border-agesci-blue sticky top-0 z-50">
        <div className="container-scout">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center group">
                {/* Desktop: full logo */}
                <Image
                  src="/Logo completo.png"
                  alt="Da Filo a Trama"
                  width={180}
                  height={70}
                  className="hidden md:block h-11 w-auto group-hover:scale-105 transition-transform"
                  priority
                />
                {/* Mobile: icon only */}
                <Image
                  src="/Logo gomitolo.png"
                  alt="Da Filo a Trama"
                  width={44}
                  height={44}
                  className="md:hidden h-10 w-10 group-hover:scale-105 transition-transform"
                  priority
                />
              </Link>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nav-link font-display text-[x-large] flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${active
                      ? 'bg-agesci-yellow text-agesci-blue font-semibold shadow-playful-sm'
                      : 'hover:bg-agesci-blue/5'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">

              {/* Avatar + Dropdown — desktop */}
              <div className="relative hidden lg:block" ref={avatarMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAvatarMenuOpen((o) => !o)}
                  aria-label="Menu utente"
                  aria-expanded={isAvatarMenuOpen}
                  className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-agesci-yellow ring-offset-2 ring-offset-scout-cream bg-agesci-blue/10 flex items-center justify-center hover:scale-105 transition-transform focus:outline-none focus:ring-4"
                >
                  <AvatarCircle />
                </button>

                {isAvatarMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-agesci-blue/10 overflow-hidden z-50">
                    {/* User info header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                      <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-agesci-yellow flex-shrink-0 bg-agesci-blue/10 flex items-center justify-center">
                        <AvatarCircle size="sm" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{displayName}</p>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setIsAvatarMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-agesci-yellow/20 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-agesci-blue flex-shrink-0" />
                        Profilo
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogoutIcon className="w-4 h-4 flex-shrink-0" />
                        Disconnettiti
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar — mobile (opens sidebar) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Apri menu"
                className="lg:hidden w-10 h-10 rounded-full overflow-hidden ring-2 ring-agesci-yellow ring-offset-2 ring-offset-scout-cream bg-agesci-blue/10 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <AvatarCircle />
              </button>

              {/* Hamburger — mobile */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-agesci-blue hover:bg-agesci-blue/5 transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-scout-cream
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:hidden pt-20 overflow-y-auto shadow-xl border-r border-agesci-blue/10
          flex flex-col
        `}
      >
        {/* Nav links */}
        <nav className="p-4 space-y-2 flex-1" aria-label="Menu mobile">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-display text-[x-large] flex items-center gap-3 px-4 py-3 rounded-xl transition-colors min-h-[44px] ${active
                  ? 'bg-agesci-yellow text-agesci-blue font-semibold shadow-playful-sm'
                  : 'text-agesci-blue hover:bg-agesci-blue/5'
                  }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User section at bottom */}
        <div className="p-4 border-t border-agesci-blue/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-agesci-yellow flex-shrink-0 bg-agesci-blue/10 flex items-center justify-center">
              <AvatarCircle />
            </div>
            <p className="font-semibold text-sm text-agesci-blue truncate">{displayName}</p>
          </div>
          <div className="space-y-1">
            <Link
              href="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-agesci-blue hover:bg-agesci-blue/5 transition-colors min-h-[44px]"
            >
              <UserIcon className="w-4 h-4" />
              Profilo
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors min-h-[44px]"
            >
              <LogoutIcon className="w-4 h-4" />
              Disconnettiti
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Icon components ─────────────────────────────────────────────────────────

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
