import { supabase } from '../../config/supabase';
import { logDebug, logError } from '../../utils/DebugHelper';
import { HomeDetails } from './homeService';

/**
 * Verifies if an invitation code is valid and returns home details
 */
export const verifyInvitationCode = async (code: string): Promise<{valid: boolean, home?: HomeDetails}> => {
  try {
    logDebug(`Verifying invitation code: ${code}`);
    
    if (!code || code.trim() === '') {
      return { valid: false };
    }
    
    // Format invitation code (uppercase, trim spaces)
    const formattedCode = code.trim().toUpperCase();
    
    // Use ilike for case-insensitive comparison instead of eq
    const { data, error } = await supabase
      .from('homes')
      .select('*')
      .ilike('invitation_code', formattedCode);
      
    if (error) {
      logError(`Error verifying invitation code: ${error.message}`);
      return { valid: false };
    }
    
    // Check if we found exactly one matching home
    if (!data || data.length === 0) {
      logDebug('No home found with this invitation code');
      return { valid: false };
    }
    
    if (data.length > 1) {
      logError(`Multiple homes found with code ${formattedCode} - this should not happen`);
      return { valid: false };
    }
    
    logDebug(`Valid home found with code ${formattedCode}: ${data[0].name}`);
    return { valid: true, home: data[0] as HomeDetails };
    
  } catch (error: any) {
    logError(`Unexpected error in verifyInvitationCode: ${error.message}`);
    return { valid: false };
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
): Promise<{success: boolean, home?: HomeDetails, error?: string}> => {
  try {
    logDebug(`Attempting to join home with code: ${inviteCode} for user: ${userId}`);
    
    // First verify and get the home details
    const verification = await verifyInvitationCode(inviteCode);
    
    if (!verification.valid || !verification.home) {
      return { 
        success: false, 
        error: 'Invalid invitation code. Please check and try again.' 
      };
    }
    
    const homeId = verification.home.id;
    logDebug(`Home found with ID: ${homeId}. Adding user as member...`);
    
    // Check if user is already a member
    const { data: existingMember, error: checkError } = await supabase
      .from('home_members')
      .select('id')
      .eq('home_id', homeId)
      .eq('user_id', userId);
      
    if (existingMember && existingMember.length > 0) {
      logDebug(`User is already a member of this home`);
      return { 
        success: true, 
        home: verification.home 
      };
    }
    
    // Add user as a member using RPC function to avoid policy issues
    const { data, error: joinError } = await supabase.rpc('insert_home_member', {
      home_id: homeId,
      user_id: userId,
      role: role,
      rent_contribution: rentContribution,
      move_in_date: new Date().toISOString().split('T')[0]
    });
    
    if (joinError || !data || !data.success) {
      logError(`Failed to join home: ${joinError?.message || 'Unknown error'}`);
      return { 
        success: false,
        error: `Failed to join home: ${joinError?.message || 'Unknown error'}`
      };
    }
    
    logDebug(`User successfully joined home: ${verification.home.name}`);
    return { success: true, home: verification.home };
    
  } catch (error: any) {
    logError(`Error joining home: ${error.message}`);
    return { 
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};
