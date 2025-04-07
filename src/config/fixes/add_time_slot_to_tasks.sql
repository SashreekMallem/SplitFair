-- Add time_slot column to tasks table for availability tracking

-- Add time_slot column if it doesn't exist
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS time_slot VARCHAR(20);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_time_slot ON public.tasks(time_slot);

-- Update existing tasks to have a default time_slot
UPDATE public.tasks SET time_slot = 'morning' WHERE time_slot IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.tasks.time_slot IS 'Time of day for the task (morning, afternoon, evening, night)';
