import { supabase } from '../../config/supabase';
import { logDebug, logError } from '../../utils/DebugHelper';

export type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  profile_image_url?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
};

/**
 * Fetches a user profile by user ID
 */
export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    if (error) {
      logError(`Error fetching user profile: ${error.message}`);
      return null;
    }
    
    return data as UserProfile;
  } catch (error: any) {
    logError(`Unexpected error in fetchUserProfile: ${error.message}`);
    return null;
  }
};

/**
 * Updates a user profile
 */
export const updateUserProfile = async (
  userId: string, 
  updates: { full_name?: string; phone_number?: string; profile_image_url?: string }
): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .eq('user_id', userId)
      .select()
      .single();
      
    if (error) {
      logError(`Error updating user profile: ${error.message}`);
      return null;
    }
    
    return data as UserProfile;
  } catch (error: any) {
    logError(`Unexpected error in updateUserProfile: ${error.message}`);
    return null;
  }
};
