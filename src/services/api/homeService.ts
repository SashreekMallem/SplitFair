import { supabase } from '../../config/supabase';
import { logDebug, logError } from '../../utils/DebugHelper';

export type HomeDetails = {
  id: string;
  name: string;
  invitation_code: string;
  street_address: string;
  unit?: string;
  city: string;
  state_province: string;
  zip_postal_code: string;
  country: string;
  monthly_rent: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date?: string;
  created_by: string;
};

export type HomeMember = {
  id: string;
  user_id: string;
  home_id: string;
  role: string;
  rent_contribution: number;
  move_in_date: string;
  move_out_date?: string;
  joined_at: string;
  full_name?: string;
  email?: string;
  profile_image_url?: string;
};

/**
 * Fetches home membership for a user with retry using RPC
 */
export const fetchUserHomeMembership = async (userId: string): Promise<any | null> => {
  try {
    // First attempt: Try direct fetch 
    const { data, error } = await supabase.rpc('get_user_home_membership', { 
      user_id_param: userId 
    });
    
    if (error || !data) {
      logError(`Error with RPC fetch: ${error?.message}`);
      
      // Fallback: Try direct fetch with limited columns and filtering client-side
      const { data: membersData, error: membersError } = await supabase
        .from('home_members')
        .select('id, home_id, role, rent_contribution, move_in_date')
        .limit(10);
        
      if (membersError) {
        logError(`Fallback query failed: ${membersError.message}`);
        return null;
      }
      
      // Filter client-side to avoid policy issues
      const memberData = membersData.find(m => m.user_id === userId);
      return memberData || null;
    }
    
    return data;
  } catch (error: any) {
    logError(`Unexpected error in fetchUserHomeMembership: ${error.message}`);
    return null;
  }
};

/**
 * Fetches home details for a specific user
 */
export const fetchUserHome = async (userId: string): Promise<HomeDetails | null> => {
  try {
    // Get the membership first with the safer approach
    const memberData = await fetchUserHomeMembership(userId);
    if (!memberData || !memberData.home_id) {
      logError('No home membership found');
      return null;
    }
    
    // Then fetch home details using the home_id
    const { data: homeData, error: homeError } = await supabase
      .from('homes')
      .select('*')
      .eq('id', memberData.home_id)
      .single();
      
    if (homeError) {
      logError(`Error fetching home details: ${homeError.message}`);
      return null;
    }
    
    return homeData as HomeDetails;
  } catch (error: any) {
    logError(`Unexpected error in fetchUserHome: ${error.message}`);
    return null;
  }
};

/**
 * Fetches all roommates for a specific home
 */
export const fetchHomeMembers = async (homeId: string, currentUserId: string): Promise<HomeMember[]> => {
  try {
    // Step 1: Get all members of the home except current user (no joins)
    const { data: memberData, error: memberError } = await supabase
      .from('home_members')
      .select('*')  // Simple select without joins
      .eq('home_id', homeId);
      
    if (memberError) {
      logError(`Error fetching home members: ${memberError.message}`);
      return [];
    }
    
    if (!memberData || memberData.length === 0) {
      return [];
    }
    
    // Filter out current user
    const otherMembers = memberData.filter(member => member.user_id !== currentUserId);
    
    // Step 2: Fetch all profiles in a single query to be more efficient
    const userIds = otherMembers.map(member => member.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('user_id', userIds); // This will now work due to the updated policy
      
    if (profilesError) {
      logError(`Error fetching user profiles: ${profilesError.message}`);
      // Continue with empty profiles array
    }
    
    // Create a map of user_id -> profile for easy lookup
    const profileMap = (profiles || []).reduce((map, profile) => {
      map[profile.user_id] = profile;
      return map;
    }, {} as Record<string, any>);
    
    // Step 3: Combine member data with profile data
    const formattedRoommates = otherMembers.map(member => {
      const profile = profileMap[member.user_id];
      return {
        ...member,
        // Use full_name from profile; fallback to user_id if missing
        full_name: profile && profile.full_name ? profile.full_name : member.user_id,
        email: profile ? profile.email : '',
        profile_image_url: profile ? profile.profile_image_url : null
      };
    });
    
    return formattedRoommates;
  } catch (error: any) {
    logError(`Unexpected error in fetchHomeMembers: ${error.message}`);
    return [];
  }
};

/**
 * Updates home details
 */
export const updateHomeDetails = async (
  homeId: string, 
  updates: Partial<HomeDetails>
): Promise<HomeDetails | null> => {
  try {
    const { data, error } = await supabase
      .from('homes')
      .update(updates)
      .eq('id', homeId)
      .select()
      .single();
      
    if (error) {
      logError(`Error updating home details: ${error.message}`);
      return null;
    }
    
    return data as HomeDetails;
  } catch (error: any) {
    logError(`Unexpected error in updateHomeDetails: ${error.message}`);
    return null;
  }
};

/**
 * Direct fetch that will likely trigger the recursion error for diagnostic purposes
 */
export const testDirectHomeMembershipFetch = async (userId: string) => {
  logDebug('DIAGNOSTIC TEST: Direct home_members query');
  
  const { data, error } = await supabase
    .from('home_members')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (error) {
    logError(`DIAGNOSTIC RESULT: ${error.message}`);
    return { error };
  }
  
  return { data };
};

/**
 * Alternative fetch using a specific ID approach that might avoid recursion
 */
export const testAlternativeMembershipFetch = async (userId: string) => {
  logDebug('DIAGNOSTIC TEST: Alternative query approach');
  
  // Try with exact column names to avoid any policy recursion
  const { data, error } = await supabase
    .from('home_members')
    .select('id, home_id, user_id, role')
    .filter('user_id', 'eq', userId)
    .limit(1);
    
  if (error) {
    logError(`DIAGNOSTIC RESULT: ${error.message}`);
    return { error };
  }
  
  return { data: data?.[0] };
};
