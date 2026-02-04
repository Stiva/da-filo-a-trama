import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-gray-100">
      <SignUp
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
        afterSignUpUrl="/onboarding"
        signInUrl="/sign-in"
      />
    </div>
  );
}
