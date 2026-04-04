-- 037_create_participants_crm.sql

-- 1. Create the `participants` table to store data from the external CSV
CREATE TABLE IF NOT EXISTS public.participants (
    codice VARCHAR(8) PRIMARY KEY,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    email_contatto TEXT,
    email_referente TEXT,
    regione TEXT,
    gruppo TEXT,
    zona TEXT,
    ruolo TEXT,
    is_active_in_list BOOLEAN DEFAULT TRUE NOT NULL,
    is_checked_in BOOLEAN DEFAULT FALSE NOT NULL,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Turn on RLS
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Admins can read and write all participants
CREATE POLICY "Admins can view participants" ON public.participants
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert participants" ON public.participants
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update participants" ON public.participants
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_participants_updated_at
BEFORE UPDATE ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.set_participants_updated_at();

-- 2. Create the View `participant_crm_view`
-- Links the participants table with the profiles table using `codice` and `codice_socio`
CREATE OR REPLACE VIEW public.participant_crm_view AS
SELECT 
    p.codice,
    p.nome,
    p.cognome,
    p.email_contatto,
    p.email_referente,
    p.regione,
    p.gruppo,
    p.zona,
    p.ruolo,
    p.is_active_in_list,
    p.is_checked_in,
    p.checked_in_at,
    p.created_at,
    p.updated_at,
    prof.id as linked_profile_id,
    prof.email as profile_email,
    prof.profile_image_url as profile_avatar_url,
    (prof.id IS NOT NULL) as is_app_registered
FROM 
    public.participants p
LEFT JOIN 
    public.profiles prof ON p.codice = prof.codice_socio;

-- Grant permissions to access view for admins
GRANT SELECT ON public.participant_crm_view TO authenticated;
