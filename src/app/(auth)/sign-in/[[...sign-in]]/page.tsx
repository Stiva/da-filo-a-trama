import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-gray-100">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: {
              backgroundColor: 'var(--scout-green)',
              '&:hover': {
                backgroundColor: 'var(--scout-green-light)',
              },
            },
            headerTitle: {
              color: 'var(--scout-green)',
            },
            footerActionLink: {
              color: 'var(--scout-azure)',
            },
          },
        }}
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
