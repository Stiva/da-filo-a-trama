# Da Filo a Trama - Evento Nazionale Scout AGESCI 2026

Piattaforma digitale per l'evento nazionale scout AGESCI 2026.
Un'applicazione web progressiva (PWA) progettata per gestire le iscrizioni, esplorare la mappa degli eventi, comunicare tramite chat e molto altro.

## ✨ Caratteristiche Principali

- **Autenticazione Sicura:** Gestita tramite [Clerk](https://clerk.dev/), con ruoli utente (user, admin, staff) e integrazione JWT con Supabase.
- **Gestione Eventi & Iscrizioni:** Esplorazione degli eventi, raccomandazioni basate sulle preferenze utente e sistema di iscrizione atomico (con gestione di waitlist e concorrenza).
- **Mappa Interattiva:** Punti di Interesse (POI) esplorabili tramite mappa interattiva (sviluppata con Leaflet).
- **Chat in Tempo Reale:** Comunicazione integrata utilizzando [Stream Chat](https://getstream.io/chat/).
- **Check-in con QR Code:** Generazione e scansione di QR Code per gestire la presenza agli eventi.
- **PWA (Progressive Web App):** Supporto offline e notifiche push (tramite `web-push`).
- **Rich Text Editor:** Editor avanzato basato su Lexical per descrizioni e comunicazioni.
- **Gestione Asset:** Caricamento e visibilità controllata di file e documenti (pubblici, registrati, staff).

## 🚀 Tecnologie

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **UI/Styling:** React 19, [Tailwind CSS](https://tailwindcss.com/)
- **Database & Backend:** [Supabase](https://supabase.com/) (PostgreSQL con estensioni PostGIS e UUID)
- **Autenticazione:** [Clerk](https://clerk.com/)
- **Mappe:** [Leaflet](https://leafletjs.com/) e `react-leaflet`
- **Chat:** `stream-chat` e `stream-chat-react`
- **Icone:** [Lucide React](https://lucide.dev/)

## 📂 Struttura del Progetto

```
.
├── src/
│   ├── app/            # Next.js App Router (Pagine, Layouts, API Routes)
│   ├── components/     # Componenti React riutilizzabili (UI, Mappa, Editor, Admin, etc.)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions, configurazione database/supabase
│   └── types/          # Definizione dei tipi TypeScript
├── supabase/
│   ├── migrations/     # File SQL per la migrazione e setup iniziale del DB
│   └── README.md       # Documentazione specifica dello schema DB
├── public/             # Asset statici (immagini, manifest.json, icone)
├── package.json        # Dipendenze e script npm
└── .env.example        # Esempio di variabili d'ambiente necessarie
```

## 🛠️ Come Iniziare

### 1. Prerequisiti

Assicurati di avere [Node.js](https://nodejs.org/) (v18+) installato sul tuo sistema.

### 2. Installazione

Clona il repository e installa le dipendenze:

```bash
npm install
```

### 3. Configurazione dell'Ambiente

Copia il file di configurazione d'esempio e rinominalo in `.env.local`:

```bash
cp .env.example .env.local
```

Compila il file `.env.local` con le tue chiavi:
- **Clerk:** Trova le chiavi di test/publishable sulla tua dashboard di Clerk. Crea un JWT Template chiamato "supabase".
- **Supabase:** Inserisci l'URL del progetto, l'anon key e la service role key.
- **Webhook Clerk:** Configura un endpoint webhook sulla dashboard di Clerk e inserisci la secret in `CLERK_WEBHOOK_SECRET`.

### 4. Setup del Database (Supabase)

Fai riferimento a `supabase/README.md` per le istruzioni dettagliate su come eseguire le migrazioni presenti nella cartella `supabase/migrations/` per configurare lo schema del database (tabelle, RLS policies, funzioni RPC e dati di test).

### 5. Avvio dell'Ambiente di Sviluppo

Avvia il server di sviluppo:

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel tuo browser per visualizzare l'applicazione.

## 📜 Licenza

AGESCI - Associazione Guide e Scout Cattolici Italiani
