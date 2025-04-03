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
    const { data, error } = await supabase
      .from('home_members')
      .select(`
        *,
        user_profiles:user_id(full_name, email, profile_image_url)
      `)
      .eq('home_id', homeId)
      .neq('user_id', currentUserId);
      
    if (error) {
      logError(`Error fetching roommates: ${error.message}`);
      return [];
    }
    
    // Process roommate data to flatten structure
    return data.map((member: any) => ({
      ...member,
      full_name: member.user_profiles?.full_name || 'Unknown',
      email: member.user_profiles?.email || '',
      profile_image_url: member.user_profiles?.profile_image_url,
    }));
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
