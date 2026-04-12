-- ============================================
-- MIGRAZIONE 045: Aggiunta nuovi Tag Preferenze
-- Aggiunge: fantasia, recitazione, comunicazione, cucina, gioco, liberta, coraggio, fiducia, promessa
-- ============================================

INSERT INTO preference_tags (slug, name, display_order) VALUES
  ('fantasia', 'Fantasia', 13),
  ('recitazione', 'Recitazione', 14),
  ('comunicazione', 'Comunicazione', 15),
  ('cucina', 'Cucina', 16),
  ('gioco', 'Gioco', 17),
  ('liberta', 'Libertà', 18),
  ('coraggio', 'Coraggio', 19),
  ('fiducia', 'Fiducia', 20),
  ('promessa', 'Promessa', 21)
ON CONFLICT (slug) DO NOTHING;
