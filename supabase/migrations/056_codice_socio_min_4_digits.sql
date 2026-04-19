-- Relax codice_socio constraint: allow 4-8 digits (was 6-8)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_codice_socio_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_codice_socio_check
    CHECK (codice_socio IS NULL OR codice_socio ~ '^[0-9]{4,8}$');
