-- ============================================
-- DA FILO A TRAMA - Schema Completo
-- ============================================
-- Esegui questo file nel SQL Editor di Supabase
-- per creare l'intero schema in una volta sola.
--
-- ORDINE DI ESECUZIONE:
-- 1. 001_extensions_and_helpers.sql
-- 2. 002_profiles.sql
-- 3. 003_events.sql
-- 4. 004_enrollments.sql
-- 5. 005_poi.sql
-- 6. 006_assets.sql
-- 7. 007_rpc_functions.sql
-- 8. 008_rls_policies.sql
-- ============================================

-- Per eseguire le migrazioni individualmente,
-- copia e incolla ogni file nel SQL Editor di Supabase
-- nell'ordine indicato sopra.

-- IMPORTANTE: Prima di eseguire, assicurati di:
-- 1. Aver creato il JWT Template "supabase" in Clerk
-- 2. Aver copiato il JWT Secret di Supabase nel template Clerk

-- ============================================
-- INCLUDE: 001_extensions_and_helpers.sql
-- ============================================
\i 001_extensions_and_helpers.sql

-- ============================================
-- INCLUDE: 002_profiles.sql
-- ============================================
\i 002_profiles.sql

-- ============================================
-- INCLUDE: 003_events.sql
-- ============================================
\i 003_events.sql

-- ============================================
-- INCLUDE: 004_enrollments.sql
-- ============================================
\i 004_enrollments.sql

-- ============================================
-- INCLUDE: 005_poi.sql
-- ============================================
\i 005_poi.sql

-- ============================================
-- INCLUDE: 006_assets.sql
-- ============================================
\i 006_assets.sql

-- ============================================
-- INCLUDE: 007_rpc_functions.sql
-- ============================================
\i 007_rpc_functions.sql

-- ============================================
-- INCLUDE: 008_rls_policies.sql
-- ============================================
\i 008_rls_policies.sql

-- ============================================
-- Verifica finale
-- ============================================
SELECT 'Schema creato con successo!' as status;
