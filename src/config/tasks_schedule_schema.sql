-- Tasks Management Tables

-- Table for storing household tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_id UUID NOT NULL REFERENCES public.homes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'missed'
    due_date DATE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    difficulty VARCHAR(20), -- 'easy', 'medium', 'hard'
    estimated_minutes INT,
    rotation_enabled BOOLEAN DEFAULT FALSE,
    repeat_frequency VARCHAR(50), -- 'daily', 'weekly', 'monthly', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Table for task rotation members
CREATE TABLE IF NOT EXISTS public.task_rotation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rotation_order INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (task_id, user_id)
);

-- Table for task completion history
CREATE TABLE IF NOT EXISTS public.task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    completed_by UUID REFERENCES auth.users(id),
    completion_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'completed', 'missed'
    rating VARCHAR(20), -- 'poor', 'good', 'excellent'
    evaluated_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for task swap requests
CREATE TABLE IF NOT EXISTS public.task_swap_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_to UUID NOT NULL REFERENCES auth.users(id),
    original_date DATE NOT NULL,
    proposed_date DATE NOT NULL,
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for penalty points
CREATE TABLE IF NOT EXISTS public.penalty_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    home_id UUID NOT NULL REFERENCES public.homes(id) ON DELETE CASCADE,
    points INT NOT NULL DEFAULT 0,
    reason TEXT,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule Management Tables

-- Table for storing household events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_id UUID NOT NULL REFERENCES public.homes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    category VARCHAR(100),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly', etc.
    recurrence_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Table for event attendees
CREATE TABLE IF NOT EXISTS public.event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'going', -- 'going', 'maybe', 'not_going'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

-- Add RLS policies for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks for their home" ON public.tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = tasks.home_id
            AND home_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create tasks for their home" ON public.tasks
    FOR INSERT
    WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = tasks.home_id
            AND home_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tasks they created or are assigned to" ON public.tasks
    FOR UPDATE
    USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = tasks.home_id
            AND home_members.user_id = auth.uid()
            AND home_members.role = 'owner'
        )
    );

-- Add RLS policies for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for their home" ON public.events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = events.home_id
            AND home_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create events for their home" ON public.events
    FOR INSERT
    WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = events.home_id
            AND home_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update events they created" ON public.events
    FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1
            FROM public.home_members
            WHERE home_members.home_id = events.home_id
            AND home_members.user_id = auth.uid()
            AND home_members.role = 'owner'
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_home_id ON public.tasks(home_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_events_home_id ON public.events(home_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
