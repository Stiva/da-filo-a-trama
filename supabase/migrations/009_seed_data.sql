-- ============================================
-- MIGRAZIONE 009: Dati di Test (Seed)
-- ============================================
-- Esegui DOPO aver creato lo schema completo

-- ============================================
-- Eventi di esempio
-- ============================================
INSERT INTO events (title, description, category, tags, speaker_name, speaker_bio, location_details, start_time, end_time, max_posti, is_published, is_featured)
VALUES
  (
    'Apertura Ufficiale - Da Filo a Trama',
    'Cerimonia di apertura dell''evento nazionale. Benvenuto a tutti i partecipanti con alzabandiera e presentazione del programma.',
    'conferenza',
    ARRAY['cerimonia', 'apertura', 'tutti'],
    'Capo Scout Nazionale',
    'Responsabile nazionale AGESCI',
    'Palco Centrale, Area Eventi',
    '2026-07-15 09:00:00+02',
    '2026-07-15 10:30:00+02',
    1500,
    true,
    true
  ),
  (
    'Workshop: Tecniche di Pioneering Avanzato',
    'Impara a costruire strutture complesse con corde e pali. Livello avanzato, richiesta esperienza base.',
    'workshop',
    ARRAY['pioneering', 'manualita', 'avanzato', 'natura'],
    'Marco Bianchi',
    'Capo Riparto con 15 anni di esperienza in tecniche scout',
    'Area Bosco Nord, Postazione 3',
    '2026-07-15 14:00:00+02',
    '2026-07-15 17:00:00+02',
    30,
    true,
    false
  ),
  (
    'Laboratorio di Espressione Teatrale',
    'Scopri il teatro come strumento educativo. Giochi di improvvisazione e tecniche di comunicazione.',
    'laboratorio',
    ARRAY['teatro', 'arte', 'espressione', 'gioco'],
    'Giulia Verdi',
    'Attrice e formatrice teatrale',
    'Tenda Grande, Settore B',
    '2026-07-15 15:00:00+02',
    '2026-07-15 17:30:00+02',
    25,
    true,
    false
  ),
  (
    'Veglia sotto le Stelle',
    'Momento di riflessione e spiritualita'' con canti e testimonianze. Porta il tuo strumento!',
    'spiritualita',
    ARRAY['spiritualita', 'musica', 'sera', 'tutti'],
    NULL,
    NULL,
    'Prato Grande, Area Fuoco',
    '2026-07-15 21:30:00+02',
    '2026-07-15 23:00:00+02',
    500,
    true,
    true
  ),
  (
    'Caccia al Tesoro Fotografica',
    'Esplora l''area evento con la tua squadra e cattura le immagini richieste. Premi per i vincitori!',
    'gioco',
    ARRAY['gioco', 'foto', 'esplorazione', 'squadra'],
    NULL,
    NULL,
    'Partenza: Info Point Centrale',
    '2026-07-16 10:00:00+02',
    '2026-07-16 12:30:00+02',
    100,
    true,
    false
  ),
  (
    'Corso Base di Primo Soccorso',
    'Tecniche essenziali di primo soccorso. Certificato di partecipazione rilasciato.',
    'workshop',
    ARRAY['primo_soccorso', 'sicurezza', 'formazione'],
    'Dott.ssa Anna Rossi',
    'Medico volontario Croce Rossa',
    'Tendone Medico, Area Servizi',
    '2026-07-16 14:00:00+02',
    '2026-07-16 18:00:00+02',
    40,
    true,
    false
  ),
  (
    'Concerto Serale: Scout Band United',
    'Concerto live con band formate da scout da tutta Italia. Rock, pop e canti tradizionali.',
    'musica',
    ARRAY['musica', 'concerto', 'sera', 'tutti'],
    'Scout Band United',
    'Formazione musicale composta da scout',
    'Palco Centrale, Area Eventi',
    '2026-07-16 21:00:00+02',
    '2026-07-16 23:30:00+02',
    1000,
    true,
    true
  ),
  (
    'Orienteering nel Bosco',
    'Gara di orientamento con mappa e bussola. Categorie per eta'' e esperienza.',
    'natura',
    ARRAY['orienteering', 'natura', 'competizione', 'outdoor'],
    'Paolo Neri',
    'Istruttore federale orienteering',
    'Partenza: Ingresso Bosco Est',
    '2026-07-17 08:00:00+02',
    '2026-07-17 12:00:00+02',
    80,
    true,
    false
  ),
  (
    'Talk: Sostenibilita'' e Scoutismo',
    'Come lo scoutismo puo'' contribuire alla sostenibilita'' ambientale. Discussione aperta.',
    'conferenza',
    ARRAY['ambiente', 'sostenibilita', 'conferenza', 'discussione'],
    'Prof. Luigi Verdi',
    'Docente di Scienze Ambientali',
    'Sala Conferenze, Edificio Principale',
    '2026-07-17 15:00:00+02',
    '2026-07-17 17:00:00+02',
    150,
    true,
    false
  ),
  (
    'Cerimonia di Chiusura',
    'Saluti finali, premiazioni e ammainabandiera. Arrivederci alla prossima!',
    'conferenza',
    ARRAY['cerimonia', 'chiusura', 'tutti'],
    'Capo Scout Nazionale',
    'Responsabile nazionale AGESCI',
    'Palco Centrale, Area Eventi',
    '2026-07-18 17:00:00+02',
    '2026-07-18 19:00:00+02',
    1500,
    true,
    true
  );

-- ============================================
-- POI di esempio
-- ============================================
INSERT INTO poi (nome, descrizione, coordinate, tipo, is_active)
VALUES
  (
    'Palco Centrale',
    'Palco principale per cerimonie e concerti',
    ST_SetSRID(ST_MakePoint(11.2558, 43.7696), 4326)::geography,
    'stage',
    true
  ),
  (
    'Info Point',
    'Punto informazioni e accoglienza',
    ST_SetSRID(ST_MakePoint(11.2560, 43.7698), 4326)::geography,
    'info',
    true
  ),
  (
    'Mensa Centrale',
    'Area ristoro principale con posti a sedere',
    ST_SetSRID(ST_MakePoint(11.2565, 43.7700), 4326)::geography,
    'food',
    true
  ),
  (
    'Punto Medico',
    'Pronto soccorso e assistenza sanitaria 24h',
    ST_SetSRID(ST_MakePoint(11.2555, 43.7695), 4326)::geography,
    'medical',
    true
  ),
  (
    'Servizi Igienici Nord',
    'Bagni e docce - Area Nord',
    ST_SetSRID(ST_MakePoint(11.2570, 43.7705), 4326)::geography,
    'toilet',
    true
  ),
  (
    'Servizi Igienici Sud',
    'Bagni e docce - Area Sud',
    ST_SetSRID(ST_MakePoint(11.2550, 43.7690), 4326)::geography,
    'toilet',
    true
  ),
  (
    'Area Campeggio Lupetti',
    'Zona tende per branchi L/C',
    ST_SetSRID(ST_MakePoint(11.2580, 43.7710), 4326)::geography,
    'camping',
    true
  ),
  (
    'Area Campeggio E/G',
    'Zona tende per reparti E/G',
    ST_SetSRID(ST_MakePoint(11.2540, 43.7685), 4326)::geography,
    'camping',
    true
  ),
  (
    'Area Campeggio R/S',
    'Zona tende per clan R/S',
    ST_SetSRID(ST_MakePoint(11.2545, 43.7680), 4326)::geography,
    'camping',
    true
  ),
  (
    'Parcheggio Principale',
    'Parcheggio auto e pullman',
    ST_SetSRID(ST_MakePoint(11.2530, 43.7675), 4326)::geography,
    'parking',
    true
  ),
  (
    'Cappella',
    'Spazio per la preghiera e celebrazioni',
    ST_SetSRID(ST_MakePoint(11.2562, 43.7702), 4326)::geography,
    'worship',
    true
  ),
  (
    'Area Attivita'' Bosco',
    'Zona per attivita'' all''aperto e pioneering',
    ST_SetSRID(ST_MakePoint(11.2590, 43.7715), 4326)::geography,
    'activity',
    true
  ),
  (
    'Ingresso Principale',
    'Accesso principale all''area evento',
    ST_SetSRID(ST_MakePoint(11.2535, 43.7678), 4326)::geography,
    'entrance',
    true
  );

-- ============================================
-- Verifica inserimento
-- ============================================
SELECT 'Seed completato!' as status,
       (SELECT COUNT(*) FROM events) as eventi_inseriti,
       (SELECT COUNT(*) FROM poi) as poi_inseriti;
