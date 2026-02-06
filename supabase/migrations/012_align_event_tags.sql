-- ============================================
-- MIGRAZIONE 012: Allineamento Event Tags con PREFERENCE_TAGS
-- ============================================
-- Questo aggiorna i tag degli eventi seed per matchare con le preferenze utente
-- PREFERENCE_TAGS: avventura, natura, creativita, spiritualita, servizio,
--                  leadership, musica, sport, tecnologia, sostenibilita,
--                  internazionale, tradizione

-- Apertura Ufficiale: tradizione + spiritualita
UPDATE events
SET tags = ARRAY['tradizione', 'spiritualita', 'servizio']
WHERE title ILIKE '%Apertura%' OR title ILIKE '%apertura%';

-- Workshop Pioneering: natura + avventura + creativita
UPDATE events
SET tags = ARRAY['natura', 'avventura', 'creativita']
WHERE title ILIKE '%Pioneering%';

-- Laboratorio Teatro: creativita
UPDATE events
SET tags = ARRAY['creativita']
WHERE title ILIKE '%Teatrale%' OR title ILIKE '%teatro%';

-- Veglia sotto le Stelle: spiritualita + musica
UPDATE events
SET tags = ARRAY['spiritualita', 'musica']
WHERE title ILIKE '%Veglia%';

-- Caccia al Tesoro Fotografica: avventura + sport
UPDATE events
SET tags = ARRAY['avventura', 'sport', 'creativita']
WHERE title ILIKE '%Caccia%Tesoro%';

-- Primo Soccorso: servizio + leadership
UPDATE events
SET tags = ARRAY['servizio', 'leadership']
WHERE title ILIKE '%Primo Soccorso%';

-- Concerto: musica + creativita
UPDATE events
SET tags = ARRAY['musica', 'creativita']
WHERE title ILIKE '%Concerto%';

-- Orienteering: natura + sport + avventura
UPDATE events
SET tags = ARRAY['natura', 'sport', 'avventura']
WHERE title ILIKE '%Orienteering%';

-- Talk Sostenibilita: sostenibilita + natura
UPDATE events
SET tags = ARRAY['sostenibilita', 'natura']
WHERE title ILIKE '%Sostenibilita%';

-- Cerimonia di Chiusura: tradizione + spiritualita
UPDATE events
SET tags = ARRAY['tradizione', 'spiritualita']
WHERE title ILIKE '%Chiusura%';

-- Verifica aggiornamento
SELECT title, tags FROM events ORDER BY start_time;
