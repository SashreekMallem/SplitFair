-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;

-- Create a new SELECT policy to allow viewing profiles of users in the same home
CREATE POLICY "View profiles of users in the same home" ON public.user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.home_members AS hm
    WHERE hm.user_id = auth.uid() -- Current user is a member of the home
      AND hm.home_id IN (
        SELECT home_id
        FROM public.home_members
        WHERE home_members.user_id = user_profiles.user_id -- Target user is in the same home
      )
  )
);

-- Ensure RLS is enabled on the table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
