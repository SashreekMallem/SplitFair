-- Fix rule_agreements and rule_comments tables

-- Create proper indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_rule_agreements_rule_id ON public.rule_agreements(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_agreements_user_id ON public.rule_agreements(user_id);

CREATE INDEX IF NOT EXISTS idx_rule_comments_rule_id ON public.rule_comments(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_comments_user_id ON public.rule_comments(user_id);

-- Create safe helper views without joins to avoid relationship issues
CREATE OR REPLACE VIEW public.rule_agreements_with_users AS
SELECT 
  ra.*,
  up.full_name as user_name
FROM 
  public.rule_agreements ra
LEFT JOIN 
  public.user_profiles up ON ra.user_id = up.user_id;

CREATE OR REPLACE VIEW public.rule_comments_with_users AS
SELECT 
  rc.*,
  up.full_name as user_name
FROM 
  public.rule_comments rc
LEFT JOIN 
  public.user_profiles up ON rc.user_id = up.user_id;

-- Ensure foreign keys are properly defined
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rule_agreements_user_id_fkey'
  ) THEN
    ALTER TABLE public.rule_agreements
    ADD CONSTRAINT rule_agreements_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rule_comments_user_id_fkey'
  ) THEN
    ALTER TABLE public.rule_comments
    ADD CONSTRAINT rule_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Failed to add constraint: %', SQLERRM;
END $$;

-- Make sure RLS is enabled
ALTER TABLE public.rule_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_comments ENABLE ROW LEVEL SECURITY;

-- Grant permissions to the views for authenticated users
GRANT SELECT ON public.rule_agreements_with_users TO authenticated;
GRANT SELECT ON public.rule_comments_with_users TO authenticated;

-- Updated permissions policy to be more permissive for SELECT operations
DROP POLICY IF EXISTS "Anyone can view rule agreements" ON public.rule_agreements;
CREATE POLICY "Anyone can view rule agreements" ON public.rule_agreements
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view rule comments" ON public.rule_comments;
CREATE POLICY "Anyone can view rule comments" ON public.rule_comments
    FOR SELECT USING (true);
