import { supabase } from '../config/supabase';

/**
 * Debug utility to get detailed information about the user's home membership
 */
export const debugUserHome = async (userId: string): Promise<void> => {
  console.log('📊 DEBUG USER HOME MEMBERSHIP');
  console.log('============================');
  console.log('User ID:', userId);
  
  try {
    // Check user exists
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.log('❌ Error fetching user:', userError.message);
      return;
    }
    
    console.log('✅ User authenticated:', user.user?.id === userId);
    
    // Check if user's metadata contains home_id
    const homeId = user.user?.user_metadata?.home_id;
    console.log('📋 User metadata home_id:', homeId || 'NOT FOUND');
    
    // Check user_profiles table
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (profileError) {
      console.log('❌ Error fetching user profile:', profileError.message);
    } else {
      console.log('✅ User profile found:', profile);
    }
    
    // Check home_members table for all homes the user belongs to
    const { data: memberships, error: membershipError } = await supabase
      .from('home_members')
      .select('*')
      .eq('user_id', userId);
    
    if (membershipError) {
      console.log('❌ Error fetching home memberships:', membershipError.message);
    } else if (!memberships || memberships.length === 0) {
      console.log('⚠️ User does not belong to any home');
    } else {
      console.log('✅ User belongs to', memberships.length, 'home(s):');
      console.table(memberships);
      
      // For each home, check details
      for (const membership of memberships) {
        const { data: home, error: homeError } = await supabase
          .from('homes')
          .select('*')
          .eq('id', membership.home_id)
          .single();
        
        if (homeError) {
          console.log(`❌ Error fetching home ${membership.home_id}:`, homeError.message);
        } else {
          console.log(`✅ Home ${membership.home_id} details:`, home);
          
          // Check other members of this home
          const { data: homeMembers, error: membersError } = await supabase
            .from('home_members')
            .select('*')
            .eq('home_id', membership.home_id);
          
          if (membersError) {
            console.log(`❌ Error fetching members of home ${membership.home_id}:`, membersError.message);
          } else {
            console.log(`✅ Home ${membership.home_id} has ${homeMembers.length} member(s)`);
            console.table(homeMembers);
          }
        }
      }
    }
    
    console.log('============================');
  } catch (err) {
    console.error('📊 DEBUG ERROR:', err);
  }
};

/**
 * Run this in a component to debug the current user's home situation
 */
export const useDebugUserHome = () => {
  // Get the current user
  supabase.auth.getUser().then(({ data }) => {
    if (data?.user) {
      debugUserHome(data.user.id);
    } else {
      console.log('⚠️ No authenticated user found for debugging');
    }
  });
};
