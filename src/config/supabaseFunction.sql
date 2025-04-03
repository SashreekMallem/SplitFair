-- Safe function to get user's home membership without triggering infinite recursion
CREATE OR REPLACE FUNCTION get_user_home_membership(user_id_param UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Execute a secure query that bypasses policy recursion
  SELECT 
    jsonb_build_object(
      'id', hm.id,
      'user_id', hm.user_id,
      'home_id', hm.home_id,
      'role', hm.role,
      'rent_contribution', hm.rent_contribution,
      'move_in_date', hm.move_in_date
    ) INTO result
  FROM public.home_members hm
  WHERE hm.user_id = user_id_param
  LIMIT 1;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_home_membership TO authenticated;
