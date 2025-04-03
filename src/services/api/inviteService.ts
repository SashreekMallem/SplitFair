import { supabase } from '../../config/supabase';
import { logDebug, logError } from '../../utils/DebugHelper';

/**
 * Verifies if an invitation code is valid
 */
export const verifyInvitationCode = async (code: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('homes')
      .select('id')
      .eq('invitation_code', code.toUpperCase())
      .single();
      
    if (error || !data) {
      logError(`Invalid invitation code: ${error?.message}`);
      return false;
    }
    
    return true;
  } catch (error: any) {
    logError(`Error verifying invitation code: ${error.message}`);
    return false;
  }
};

/**
 * Uses an invitation code to join a home
 */
export const joinHomeWithInvite = async (
  userId: string, 
  inviteCode: string, 
  role: string = 'member',
  rentContribution: number = 0
): Promise<boolean> => {
  try {
    // First find the home with this invite code
    const { data: homeData, error: homeError } = await supabase
      .from('homes')
      .select('id')
      .eq('invitation_code', inviteCode.toUpperCase())
      .single();
      
    if (homeError || !homeData) {
      logError(`Invalid invitation code: ${homeError?.message}`);
      return false;
    }
    
    // Add user as a member
    const { error: joinError } = await supabase.rpc('insert_home_member', {
      home_id: homeData.id,
      user_id: userId,
      role: role,
      rent_contribution: rentContribution,
      move_in_date: new Date().toISOString().split('T')[0]
    });
    
    if (joinError) {
      logError(`Failed to join home: ${joinError.message}`);
      return false;
    }
    
    return true;
  } catch (error: any) {
    logError(`Error joining home: ${error.message}`);
    return false;
  }
};
