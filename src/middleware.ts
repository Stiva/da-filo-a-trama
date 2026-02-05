import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';

// Route pubbliche accessibili senza autenticazione
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/events',        // Lista eventi pubblica
  '/api/poi',           // POI pubblici
  '/api/webhooks(.*)',  // Webhook Clerk (verifica propria firma)
]);

// Route riservate agli admin
const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  // Proteggi tutte le route non pubbliche
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  // Verifica ruolo admin per route amministrative
  if (isAdminRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Ottieni i metadata dell'utente direttamente da Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = (user.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return new Response('Forbidden', { status: 403 });
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
