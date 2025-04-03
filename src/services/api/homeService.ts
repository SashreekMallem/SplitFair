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
 * Fetches home details for a specific user
 */
export const fetchUserHome = async (userId: string): Promise<HomeDetails | null> => {
  try {
    // First get user's home membership
    const { data: memberData, error: memberError } = await supabase
      .from('home_members')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    if (memberError) {
      logError(`Error fetching home membership: ${memberError.message}`);
      return null;
    }
    
    // Then fetch the home details
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
