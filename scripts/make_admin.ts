import { clerkClient } from '@clerk/nextjs/server';

async function makeAdmin() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Specifica l\\'email dell\\'utente come argomento. Esempio: npx tsx scripts/make_admin.ts tua@email.com');
    process.exit(1);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY mancante! Passala come variabile d\\'ambiente.');
    process.exit(1);
  }

  console.log(`Cerco l\\'utente con email: ${email}`);

  try {
    const client = await clerkClient();
    const result = await client.users.getUserList({ emailAddress: [email] });

    if (result.data.length === 0) {
      console.error(`Nessun utente trovato con l\\'email ${email}`);
      process.exit(1);
    }

    const user = result.data[0];
    
    console.log(`Utente trovato: ${user.id} (${user.firstName} ${user.lastName})`);
    
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        role: 'admin'
      }
    });

    console.log(`Successo! L\\'utente ${email} e' ora un admin.`);
  } catch (error) {
    console.error('Si e\\' verificato un errore:', error);
  }
}

makeAdmin();
