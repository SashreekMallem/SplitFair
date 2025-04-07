-- Create a table to store user availability preferences

CREATE TABLE IF NOT EXISTS public.user_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    availability_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

-- Users can view their own availability
CREATE POLICY "Users can view their own availability" ON public.user_availability
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can view availability of members in their home
CREATE POLICY "Users can view availability of home members" ON public.user_availability
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.home_members AS user_home
            JOIN public.home_members AS other_home ON user_home.home_id = other_home.home_id
            WHERE user_home.user_id = auth.uid()
            AND other_home.user_id = user_availability.user_id
        )
    );

-- Users can update their own availability
CREATE POLICY "Users can update their own availability" ON public.user_availability
    FOR UPDATE
    USING (user_id = auth.uid());

-- Users can insert their own availability
CREATE POLICY "Users can insert their own availability" ON public.user_availability
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_availability TO authenticated;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON public.user_availability(user_id);
