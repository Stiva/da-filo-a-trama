-- ============================================
-- MIGRAZIONE 036: Add Codice Socio
-- ============================================

-- Aggiungi colonna codice_socio alla tabella profiles (se non esiste)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='codice_socio') THEN
        ALTER TABLE profiles 
        ADD COLUMN codice_socio VARCHAR(8) UNIQUE;

        -- Aggiungi il check constraint per validare numeri di 6-8 caratteri
        ALTER TABLE profiles
        ADD CONSTRAINT check_codice_socio_format
        CHECK (codice_socio IS NULL OR codice_socio ~ '^[0-9]{6,8}$');
        
        COMMENT ON COLUMN profiles.codice_socio IS 'Codice identificativo socio AGESCI (6-8 cifre)';
    END IF;
END $$;
