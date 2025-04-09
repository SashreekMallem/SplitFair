-- Add requires_multiple_people column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_multiple_people BOOLEAN DEFAULT FALSE;

-- Create new task_assignees table for multiple assignees
CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no duplicate assignments
  UNIQUE (task_id, user_id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);

-- Create view to get tasks with their assignees
CREATE OR REPLACE VIEW tasks_with_assignees AS
SELECT 
  t.*,
  COALESCE(
    json_agg(
      json_build_object(
        'user_id', ta.user_id,
        'assignment_order', ta.assignment_order
      )
    ) FILTER (WHERE ta.id IS NOT NULL),
    '[]'::json
  ) as assignees
FROM tasks t
LEFT JOIN task_assignees ta ON t.id = ta.task_id
GROUP BY t.id;

-- Add RLS policies for task_assignees
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Policy for users to view task assignees if they're in the same home
CREATE POLICY view_task_assignees ON task_assignees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN home_members hm ON t.home_id = hm.home_id
      WHERE t.id = task_assignees.task_id 
      AND hm.user_id = auth.uid()
    )
  );

-- Policy for users to insert their own task assignees
CREATE POLICY insert_task_assignees ON task_assignees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN home_members hm ON t.home_id = hm.home_id
      WHERE t.id = task_assignees.task_id 
      AND hm.user_id = auth.uid()
    )
  );

-- Policy for users to delete task assignees for tasks they created
CREATE POLICY delete_task_assignees ON task_assignees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignees.task_id 
      AND t.created_by = auth.uid()
    )
  );
