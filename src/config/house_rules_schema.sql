-- House Rules Tables Schema

-- Table for storing house rules
CREATE TABLE IF NOT EXISTS public.house_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_id UUID NOT NULL REFERENCES public.homes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Add RLS policies for house_rules
ALTER TABLE public.house_rules ENABLE ROW LEVEL SECURITY;

-- Policy for selecting house rules - users can see rules for their home
CREATE POLICY "Users can view house rules for their home" ON public.house_rules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = house_rules.home_id
            AND home_members.user_id = auth.uid()
        )
    );

-- Policy for inserting house rules - users can add rules to their home
CREATE POLICY "Users can add rules to their home" ON public.house_rules
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = house_rules.home_id
            AND home_members.user_id = auth.uid()
        )
    );

-- Policy for updating house rules - users can edit rules they created
CREATE POLICY "Users can edit their own rules" ON public.house_rules
    FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = house_rules.home_id
            AND home_members.user_id = auth.uid()
            AND home_members.role = 'owner'
        )
    );

-- Table for tracking rule agreements
CREATE TABLE IF NOT EXISTS public.rule_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES public.house_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (rule_id, user_id)
);

-- Add RLS policies for rule_agreements
ALTER TABLE public.rule_agreements ENABLE ROW LEVEL SECURITY;

-- Policy for selecting agreements - users can see all agreements for rules in their home
CREATE POLICY "Users can view rule agreements for their home" ON public.rule_agreements
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

-- Policy for inserting agreements - users can agree only for themselves
CREATE POLICY "Users can agree to rules" ON public.rule_agreements
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
    );

-- Policy for deleting agreements - users can withdraw only their own agreements
CREATE POLICY "Users can withdraw their agreements" ON public.rule_agreements
    FOR DELETE
    USING (
        user_id = auth.uid()
    );

-- Table for rule comments
CREATE TABLE IF NOT EXISTS public.rule_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES public.house_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for rule_comments
ALTER TABLE public.rule_comments ENABLE ROW LEVEL SECURITY;

-- Policy for selecting comments - users can see all comments for rules in their home
CREATE POLICY "Users can view rule comments for their home" ON public.rule_comments
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

-- Policy for inserting comments - users can add comments to any rule in their home
CREATE POLICY "Users can add comments to rules in their home" ON public.rule_comments
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1
            FROM public.house_rules
            JOIN public.home_members ON house_rules.home_id = home_members.home_id
            WHERE house_rules.id = rule_comments.rule_id
            AND home_members.user_id = auth.uid()
        )
    );

-- Policy for updating comments - users can edit their own comments
CREATE POLICY "Users can edit their own comments" ON public.rule_comments
    FOR UPDATE
    USING (
        user_id = auth.uid()
    );

-- Policy for deleting comments - users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON public.rule_comments
    FOR DELETE
    USING (
        user_id = auth.uid()
    );
