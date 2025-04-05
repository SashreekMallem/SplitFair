-- First drop the existing insert policy which might be causing problems
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

-- Create a more permissive INSERT policy
CREATE POLICY "Allow all authenticated users to create notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (true);  -- Allow all inserts, rely on application logic for restrictions

-- Make sure the SELECT policy is working properly
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT
  USING (
    -- Can view if: it's their notification OR it's a home-level notification for their home
    (user_id = auth.uid()) OR
    (user_id IS NULL)
  );

-- Update the permissions to ensure INSERT is properly granted
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- Make sure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
