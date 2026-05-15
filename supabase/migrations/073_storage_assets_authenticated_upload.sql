-- ============================================
-- MIGRAZIONE 073: RLS storage per upload TUS resumable
-- ============================================
--
-- Gli upload precedenti usavano signed URL generati lato server con
-- service_role, bypassando RLS. Per file grandi (>~50MB) iOS Safari
-- chiude la fetch monolitica del PUT con "Load failed", quindi i client
-- ora usano TUS resumable (chunk da 6MB) con il JWT Clerk autenticato.
--
-- Le policy seguenti permettono agli utenti autenticati di leggere e
-- scrivere nel bucket "assets". L'autorizzazione fine (chi può caricare
-- per quale gruppo/evento) resta sugli endpoint Next.js che generano
-- il path: il path include UUID/timestamp randomizzati, quindi non è
-- enumerabile, e la commit row in `assets` / `event_group_attachments`
-- viene creata solo se l'API conferma la membership.

DROP POLICY IF EXISTS "assets_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "assets_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "assets_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "assets_authenticated_delete" ON storage.objects;

CREATE POLICY "assets_authenticated_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'assets');

CREATE POLICY "assets_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assets');

CREATE POLICY "assets_authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assets')
  WITH CHECK (bucket_id = 'assets');

CREATE POLICY "assets_authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'assets');
