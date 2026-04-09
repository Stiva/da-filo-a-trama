-- 042_fix_profiles_service_role.sql

-- Rimuove il vincolo stringente (CHECK) inserito nella migration 027 
-- sulla colonna service_role di profiles, in quanto andava in conflitto
-- con i nuovi ruoli importati dal CRM e con il nuovo ruolo "Staff evento".

DO $$
DECLARE
    con_name text;
BEGIN
    SELECT conname INTO con_name
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%service_role%';

    IF con_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(con_name);
    END IF;
END $$;
