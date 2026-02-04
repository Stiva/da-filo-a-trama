import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/dashboard" className="font-bold text-xl" style={{ color: 'var(--scout-green)' }}>
                Da Filo a Trama
              </Link>
            </div>

            {/* Nav Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/events" className="text-gray-600 hover:text-gray-900">
                Eventi
              </Link>
              <Link href="/map" className="text-gray-600 hover:text-gray-900">
                Mappa
              </Link>
              <Link href="/profile" className="text-gray-600 hover:text-gray-900">
                Profilo
              </Link>
            </div>

            {/* User Menu */}
            <div className="flex items-center">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-10 h-10',
                  },
                }}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {children}
    </div>
  );
}
