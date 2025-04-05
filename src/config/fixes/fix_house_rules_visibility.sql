-- Drop the existing SELECT policy for house rules
DROP POLICY IF EXISTS "Users can view house rules for their home" ON public.house_rules;

-- Create an improved SELECT policy that ensures all home members can see rules
CREATE POLICY "Home members can view all house rules for their home" ON public.house_rules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = house_rules.home_id
            AND home_members.user_id = auth.uid()
        )
    );

-- Enable RLS on house_rules table
ALTER TABLE public.house_rules ENABLE ROW LEVEL SECURITY;

-- Make sure other related policies are properly set
DROP POLICY IF EXISTS "Users can view rule agreements for their home" ON public.rule_agreements;

-- Update policy for viewing rule agreements
CREATE POLICY "Home members can view all rule agreements for their home" ON public.rule_agreements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.house_rules
            JOIN public.home_members ON house_rules.home_id = home_members.home_id
            WHERE house_rules.id = rule_agreements.rule_id
            AND home_members.user_id = auth.uid()
        )
    );

-- Enable RLS on rule_agreements table
ALTER TABLE public.rule_agreements ENABLE ROW LEVEL SECURITY;

-- Similarly for rule_comments
DROP POLICY IF EXISTS "Users can view rule comments for their home" ON public.rule_comments;

-- Update policy for viewing rule comments
CREATE POLICY "Home members can view all rule comments for their home" ON public.rule_comments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.house_rules
            JOIN public.home_members ON house_rules.home_id = home_members.home_id
            WHERE house_rules.id = rule_comments.rule_id
            AND home_members.user_id = auth.uid()
        )
    );

-- Enable RLS on rule_comments table
ALTER TABLE public.rule_comments ENABLE ROW LEVEL SECURITY;
