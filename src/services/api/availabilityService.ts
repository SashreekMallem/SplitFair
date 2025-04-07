import { supabase } from '../../config/supabase';

/**
 * Interface for user availability data structure
 */
export interface UserAvailability {
  [day: string]: {
    [timeSlot: string]: boolean;
  };
}

/**
 * Save a user's availability preferences to the database
 */
export const saveUserAvailability = async (
  userId: string, 
  availability: UserAvailability
): Promise<boolean> => {
  try {
    // Check if an entry already exists
    const { data: existingEntry } = await supabase
      .from('user_availability')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingEntry) {
      // Update existing entry
      const { error } = await supabase
        .from('user_availability')
        .update({
          availability_data: availability,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingEntry.id);
        
      if (error) {
        console.error('Error updating availability:', error);
        return false;
      }
    } else {
      // Create new entry
      const { error } = await supabase
        .from('user_availability')
        .insert({
          user_id: userId,
          availability_data: availability
        });
        
      if (error) {
        console.error('Error creating availability:', error);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error in saveUserAvailability:', error);
    return false;
  }
};

/**
 * Get a user's availability preferences from the database
 */
export const getUserAvailability = async (
  userId: string
): Promise<UserAvailability | null> => {
  try {
    const { data, error } = await supabase
      .from('user_availability')
      .select('availability_data')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching availability:', error);
      return null;
    }
    
    return data?.availability_data || null;
  } catch (error) {
    console.error('Unexpected error in getUserAvailability:', error);
    return null;
  }
};

/**
 * Get availability for multiple users
 */
export const getTeamAvailability = async (
  userIds: string[]
): Promise<Record<string, UserAvailability>> => {
  try {
    const { data, error } = await supabase
      .from('user_availability')
      .select('user_id, availability_data')
      .in('user_id', userIds);
      
    if (error) {
      console.error('Error fetching team availability:', error);
      return {};
    }
    
    // Convert array to object keyed by user_id
    return data.reduce((acc, item) => {
      acc[item.user_id] = item.availability_data;
      return acc;
    }, {} as Record<string, UserAvailability>);
  } catch (error) {
    console.error('Unexpected error in getTeamAvailability:', error);
    return {};
  }
};

/**
 * Check if a user is available at a specific time
 */
export const isUserAvailableAt = (
  availability: UserAvailability | null,
  day: string,
  timeSlot: string
): boolean => {
  if (!availability || !availability[day] || !availability[day][timeSlot]) {
    return false;
  }
  return availability[day][timeSlot];
};

/**
 * Find users who are available at a specific time
 */
export const findAvailableUsers = (
  teamAvailability: Record<string, UserAvailability>,
  day: string,
  timeSlot: string
): string[] => {
  return Object.keys(teamAvailability).filter(userId => 
    isUserAvailableAt(teamAvailability[userId], day, timeSlot)
  );
};
