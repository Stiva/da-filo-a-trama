-- ============================================
-- MIGRAZIONE 043: Aggiunta flag is_fantastic a POI
-- ============================================

ALTER TABLE poi 
ADD COLUMN IF NOT EXISTS is_fantastic BOOLEAN DEFAULT false;

-- Aggiorniamo le viste o le funzioni se necessario, ma non essendoci filter strict su questa colonna al momento, non ci sono constraint o trigger particolari necessari.
COMMENT ON COLUMN poi.is_fantastic IS 'Indica se il POI è un "Luogo Fantastico" per ordinamenti speciali in mappa e formattazione';
