-- First, let's drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Users can agree to rules" ON public.rule_agreements;
DROP POLICY IF EXISTS "Any authenticated user can agree to rules" ON public.rule_agreements;

-- Create a more permissive policy for inserting agreements
CREATE POLICY "Any authenticated user can add agreements" ON public.rule_agreements
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL AND  -- User must be authenticated
        user_id = auth.uid()        -- User can only create agreements for themselves
    );

-- Ensure users can delete their own agreements
DROP POLICY IF EXISTS "Users can withdraw their agreements" ON public.rule_agreements;
CREATE POLICY "Users can withdraw their own agreements" ON public.rule_agreements
    FOR DELETE
    USING (user_id = auth.uid());

-- Double check that the SELECT policy is permissive enough
DROP POLICY IF EXISTS "Anyone can view rule agreements" ON public.rule_agreements;
CREATE POLICY "Anyone can view rule agreements" ON public.rule_agreements
    FOR SELECT USING (true);

-- Make sure RLS is enabled for this table
ALTER TABLE public.rule_agreements ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON public.rule_agreements TO authenticated;
