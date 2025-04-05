import { supabase } from '../../config/supabase';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  user_id: string | null; // null for home-level notifications
  home_id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  category: string;
  reference_id?: string; // Optional ID for related entity (like rule_id)
  is_read: boolean;
  created_at: string;
}

/**
 * Create a new notification
 */
export const createNotification = async (
  notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        ...notification,
        is_read: false,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('Unexpected error in createNotification:', error);
    return null;
  }
};

/**
 * Create a notification for all members of a home
 */
export const createHomeNotification = async (
  home_id: string,
  title: string, 
  message: string,
  level: NotificationLevel = 'info',
  category: string = 'general',
  reference_id?: string
): Promise<boolean> => {
  try {
    const notification = {
      user_id: null, // null means it's for all home members
      home_id,
      title,
      message,
      level,
      category,
      reference_id
    };
    
    const id = await createNotification(notification);
    return !!id;
  } catch (error) {
    console.error('Error creating home notification:', error);
    return false;
  }
};

/**
 * Create a notification for a specific user
 */
export const createUserNotification = async (
  user_id: string,
  home_id: string,
  title: string, 
  message: string,
  level: NotificationLevel = 'info',
  category: string = 'general',
  reference_id?: string
): Promise<boolean> => {
  try {
    const notification = {
      user_id,
      home_id,
      title,
      message,
      level,
      category,
      reference_id
    };
    
    const id = await createNotification(notification);
    return !!id;
  } catch (error) {
    console.error('Error creating user notification:', error);
    return false;
  }
};

/**
 * Get notifications for a user in a specific home
 * Includes both user-specific and home-level notifications
 */
export const getUserNotifications = async (
  userId: string,
  homeId: string,
  limit: number = 20,
  offset: number = 0,
  unreadOnly: boolean = false
): Promise<Notification[]> => {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('home_id', homeId)
      .or(`user_id.eq.${userId},user_id.is.null`) // Get both user-specific and home-level (null user_id)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);
      
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    
    return data as Notification[];
  } catch (error) {
    console.error('Unexpected error in getUserNotifications:', error);
    return [];
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    return !error;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Mark all notifications as read for a user in a home
 */
export const markAllNotificationsAsRead = async (userId: string, homeId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('home_id', homeId)
      .or(`user_id.eq.${userId},user_id.is.null`);
    
    return !error;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

/**
 * Get unread notification count for a user in a home
 */
export const getUnreadCount = async (userId: string, homeId: string): Promise<number> => {
  try {
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('home_id', homeId)
      .eq('is_read', false)
      .or(`user_id.eq.${userId},user_id.is.null`);
    
    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Unexpected error in getUnreadCount:', error);
    return 0;
  }
};
