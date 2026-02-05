import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-scout-cream">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-agesci-yellow/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-lc-green/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-agesci-blue rounded-2xl shadow-yellow mb-4">
            <span className="text-white font-display font-bold text-2xl">DF</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-agesci-blue">
            Da Filo a Trama
          </h1>
          <p className="text-agesci-blue/60 text-sm mt-1">Evento Scout 2026</p>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-white border-3 border-agesci-blue rounded-2xl shadow-playful',
              headerTitle: 'font-display text-agesci-blue',
              headerSubtitle: 'text-agesci-blue/60',
              socialButtonsBlockButton:
                'border-2 border-agesci-blue/20 hover:bg-agesci-blue/5 rounded-xl',
              formButtonPrimary:
                'bg-agesci-yellow text-agesci-blue hover:shadow-playful rounded-xl font-semibold transition-all',
              formFieldInput:
                'border-2 border-agesci-blue/30 rounded-lg focus:border-agesci-blue focus:ring-agesci-blue/20',
              footerActionLink: 'text-agesci-blue hover:text-agesci-blue-light',
              identityPreviewEditButton: 'text-agesci-blue',
            },
          }}
          fallbackRedirectUrl="/dashboard"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
