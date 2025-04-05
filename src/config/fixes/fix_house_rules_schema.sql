-- Fix the house_rules schema to ensure proper relationships

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_house_rules_created_by ON public.house_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_house_rules_home_id ON public.house_rules(home_id);

-- Add explicit foreign key to user profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'house_rules_created_by_fkey'
  ) THEN
    ALTER TABLE public.house_rules
    ADD CONSTRAINT house_rules_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Failed to add constraint: %', SQLERRM;
END $$;

-- Create a function to get creator name
CREATE OR REPLACE FUNCTION get_rule_creator_name(creator_id UUID) 
RETURNS TEXT AS $$
DECLARE
  creator_name TEXT;
BEGIN
  SELECT full_name INTO creator_name 
  FROM public.user_profiles 
  WHERE user_id = creator_id;
  
  RETURN COALESCE(creator_name, 'Unknown');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view that joins house rules with creator names for easier querying
CREATE OR REPLACE VIEW public.house_rules_with_creators AS
SELECT 
  hr.*,
  up.full_name as creator_name
FROM 
  public.house_rules hr
LEFT JOIN 
  public.user_profiles up ON hr.created_by = up.user_id;

-- Grant permissions
GRANT SELECT ON public.house_rules_with_creators TO authenticated;
GRANT EXECUTE ON FUNCTION get_rule_creator_name TO authenticated;
