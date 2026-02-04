# Database Schema - Da Filo a Trama

## Struttura Migrazioni

Esegui i file SQL **in ordine** nel SQL Editor di Supabase (Dashboard > SQL Editor).

| File | Descrizione |
|------|-------------|
| `001_extensions_and_helpers.sql` | Estensioni (uuid, PostGIS) e funzioni helper Clerk JWT |
| `002_profiles.sql` | Tabella profili utente con preferences e avatar_config |
| `003_events.sql` | Tabella eventi con tags e categorie |
| `004_enrollments.sql` | Tabella iscrizioni con status (confirmed/waitlist/cancelled) |
| `005_poi.sql` | Points of Interest con coordinate geografiche |
| `006_assets.sql` | File e documenti scaricabili |
| `007_rpc_functions.sql` | Funzioni RPC per iscrizioni atomiche e raccomandazioni |
| `008_rls_policies.sql` | Row Level Security policies |
| `009_seed_data.sql` | Dati di test (eventi e POI) |

## Come Eseguire

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **SQL Editor**
4. Copia e incolla il contenuto di ogni file **in ordine**
5. Clicca **Run**

## Schema Tabelle

```
profiles
├── id (UUID, PK)
├── clerk_id (VARCHAR, Clerk user ID)
├── email
├── name, surname
├── scout_group
├── preferences (TEXT[]) ──────┐
├── avatar_config (JSONB)      │ Matching
├── onboarding_completed       │
├── role (user/admin/staff)    │
└── timestamps                 │
                               │
events                         │
├── id (UUID, PK)              │
├── title, description         │
├── category                   │
├── tags (TEXT[]) ─────────────┘
├── speaker_name, speaker_bio
├── location_details
├── location_poi_id ──────────────┐
├── start_time, end_time          │
├── max_posti                     │
├── is_published, is_featured     │
└── timestamps                    │
                                  │
enrollments                       │
├── id (UUID, PK)                 │
├── user_id → profiles(id)        │
├── event_id → events(id)         │
├── status (confirmed/waitlist)   │
├── waitlist_position             │
├── checked_in_at                 │
└── timestamps                    │
                                  │
poi ◄─────────────────────────────┘
├── id (UUID, PK)
├── nome, descrizione
├── coordinate (GEOGRAPHY)
├── tipo (stage/food/toilet/...)
├── assets_url (JSONB)
├── is_active
└── timestamps

assets
├── id (UUID, PK)
├── event_id → events(id)
├── poi_id → poi(id)
├── file_url, file_name
├── tipo (pdf/image/video/...)
├── visibilita (public/registered/staff)
└── timestamps
```

## Funzioni RPC

### `enroll_user_to_event(event_id)`
Iscrizione atomica con gestione concorrenza. Restituisce:
- `success`: boolean
- `status`: 'confirmed' | 'waitlist'
- `waitlist_position`: numero (se in waitlist)

### `cancel_enrollment(event_id)`
Cancella iscrizione e promuove primo in waitlist.

### `get_recommended_events(limit, offset)`
Eventi raccomandati basati su matching `profiles.preferences` ↔ `events.tags`.

### `check_event_availability(event_id)`
Verifica posti disponibili senza iscriversi.

### `find_nearby_poi(lat, lng, radius_meters)`
Trova POI vicini a un punto geografico.

## RLS (Row Level Security)

Tutte le tabelle hanno RLS attivo:

- **profiles**: lettura pubblica, modifica solo proprio profilo
- **events**: visibili solo se `is_published = true` (admin vede tutto)
- **enrollments**: utente vede solo proprie iscrizioni
- **poi**: visibili solo se `is_active = true`
- **assets**: visibilità basata su campo `visibilita`
