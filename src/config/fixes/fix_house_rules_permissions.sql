-- Drop ALL existing house_rules policies to start fresh
DROP POLICY IF EXISTS "Users can view house rules for their home" ON public.house_rules;
DROP POLICY IF EXISTS "Home members can view all house rules for their home" ON public.house_rules;
DROP POLICY IF EXISTS "Users can add rules to their home" ON public.house_rules;
DROP POLICY IF EXISTS "Users can edit their own rules" ON public.house_rules;

-- Ensure the table has RLS enabled
ALTER TABLE public.house_rules ENABLE ROW LEVEL SECURITY;

-- Create simpler, more permissive policies for house rules visibility
CREATE POLICY "Anyone can view house rules" ON public.house_rules
    FOR SELECT USING (true);

-- Create policy for inserting house rules - any authenticated user can create rules
CREATE POLICY "Any authenticated user can add rules" ON public.house_rules
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for updating house rules - creator or home owner can edit
CREATE POLICY "Creator or home owner can edit house rules" ON public.house_rules
    FOR UPDATE USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = house_rules.home_id
            AND home_members.user_id = auth.uid()
            AND home_members.role = 'owner'
        )
    );

-- Policy for soft-deleting rules (setting is_active to false)
CREATE POLICY "Creator or home owner can soft-delete rules" ON public.house_rules
    FOR UPDATE USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = house_rules.home_id
            AND home_members.user_id = auth.uid()
            AND home_members.role = 'owner'
        )
    ) 
    WITH CHECK (
        is_active = false -- Only allow updates that set is_active to false
    );

-- Repeat similar fixes for rule_agreements table
DROP POLICY IF EXISTS "Users can view rule agreements for their home" ON public.rule_agreements;
DROP POLICY IF EXISTS "Home members can view all rule agreements for their home" ON public.rule_agreements;
DROP POLICY IF EXISTS "Users can agree to rules" ON public.rule_agreements;
DROP POLICY IF EXISTS "Users can withdraw their agreements" ON public.rule_agreements;

-- Create more permissive policies for rule_agreements
CREATE POLICY "Anyone can view rule agreements" ON public.rule_agreements
    FOR SELECT USING (true);

-- Repeat for rule_comments table
DROP POLICY IF EXISTS "Users can view rule comments for their home" ON public.rule_comments;
DROP POLICY IF EXISTS "Home members can view all rule comments for their home" ON public.rule_comments;
DROP POLICY IF EXISTS "Users can add comments to rules in their home" ON public.rule_comments;
DROP POLICY IF EXISTS "Users can edit their own comments" ON public.rule_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.rule_comments;

-- Create more permissive policies for rule_comments
CREATE POLICY "Anyone can view rule comments" ON public.rule_comments
    FOR SELECT USING (true);

CREATE POLICY "Any authenticated user can add comments" ON public.rule_comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can edit their own comments" ON public.rule_comments
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON public.rule_comments
    FOR DELETE USING (user_id = auth.uid());
