-- Drop ALL existing SELECT policies on home_members table to start clean
DROP POLICY IF EXISTS "Home owners can view all members" ON public.home_members;
DROP POLICY IF EXISTS "View home members simple" ON public.home_members;
DROP POLICY IF EXISTS "View home memberships" ON public.home_members;

-- Create a SECURITY DEFINER function to safely check home membership without recursion
CREATE OR REPLACE FUNCTION can_view_home_members(home_id_arg uuid)
RETURNS BOOLEAN AS $$
BEGIN
  -- Direct custom query that doesn't trigger policy checks (security definer)
  RETURN EXISTS (
    -- Either the user is the home creator
    SELECT 1 
    FROM public.homes 
    WHERE id = home_id_arg 
    AND created_by = auth.uid()
  ) OR EXISTS (
    -- Or the user is a member of the same home
    SELECT 1 
    FROM public.home_members
    WHERE home_id = home_id_arg
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION can_view_home_members TO authenticated;

-- Create a single simple SELECT policy that uses the security definer function
CREATE POLICY "Universal home members view policy" ON public.home_members
  FOR SELECT
  USING (
    -- Use the security definer function to avoid recursion
    can_view_home_members(home_id)
  );

-- Ensure the UPDATE policy is properly defined (consolidate duplicates)
DROP POLICY IF EXISTS "Update own membership" ON public.home_members;
DROP POLICY IF EXISTS "Users can update own membership" ON public.home_members;

CREATE POLICY "Update own membership" ON public.home_members
  FOR UPDATE
  USING (auth.uid() = user_id);
