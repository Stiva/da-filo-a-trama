'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import AvatarPreview from '@/components/AvatarPreview';

interface ProfileData {
    profile_image_url?: string | null;
    avatar_config?: Record<string, unknown> | null;
    name?: string | null;
    surname?: string | null;
}

export default function UserDropdownMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const { user } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const appProfileImageUrl = profile?.profile_image_url ?? null;
    const hasAvatarConfig = !!profile?.avatar_config;

    const displayName =
        [profile?.name, profile?.surname].filter(Boolean).join(' ') ||
        user?.firstName ||
        user?.username ||
        'Utente';

    const avatarFallbackLetter =
        user?.firstName?.charAt(0)?.toUpperCase() ||
        user?.username?.charAt(0)?.toUpperCase() ||
        'U';

    const handleSignOut = async () => {
        setIsOpen(false);
        await signOut();
        router.push('/');
    };

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
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen((o) => !o)}
                aria-label="Menu utente"
                aria-expanded={isOpen}
                className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-agesci-yellow ring-offset-2 ring-offset-scout-cream bg-agesci-blue/10 flex items-center justify-center hover:scale-105 transition-transform focus:outline-none focus:ring-4"
            >
                <AvatarCircle />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-agesci-blue/10 overflow-hidden z-50">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                        <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-agesci-yellow flex-shrink-0 bg-agesci-blue/10 flex items-center justify-center">
                            <AvatarCircle size="sm" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">{displayName}</p>
                        </div>
                    </div>

                    <div className="py-1">
                        <Link
                            href="/profile"
                            onClick={() => setIsOpen(false)}
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
    );
}

// Inline icons to keep component self-contained
function UserIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
