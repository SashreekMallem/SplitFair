import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as notificationService from '../services/api/notificationService';
import { Notification } from '../services/api/notificationService';
import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useNotifications = (homeId?: string) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference to the realtime subscription
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (limit: number = 20, offset: number = 0) => {
    if (!user?.id || !homeId) {
      return;
    }
    
    setLoading(true);
    try {
      const data = await notificationService.getUserNotifications(user.id, homeId, limit, offset);
      setNotifications(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user, homeId]);
  
  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id || !homeId) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const count = await notificationService.getUnreadCount(user.id, homeId);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [user, homeId]);
  
  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) {
      return false;
    }
    
    try {
      const success = await notificationService.markNotificationAsRead(notificationId);
      if (success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return success;
    } catch (err) {
      return false;
    }
  }, [user]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id || !homeId) {
      return false;
    }
    
    try {
      const success = await notificationService.markAllNotificationsAsRead(user.id, homeId);
      if (success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
      return success;
    } catch (err) {
      return false;
    }
  }, [user, homeId]);
  
  // Set up realtime subscription
  useEffect(() => {
    if (!user?.id || !homeId) {
      return;
    }
    
    // Clean up any existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    
    // Create a new subscription for notifications table
    const subscription = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (insert, update, delete)
          schema: 'public',
          table: 'notifications',
          filter: `home_id=eq.${homeId}` // Filter for this specific home
        },
        (payload) => {
          console.log('Real-time notification update:', payload);
          
          // Handle different event types
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification;
            
            // Only add if it's for this user or for all users (null user_id)
            if (newNotification.user_id === user.id || newNotification.user_id === null) {
              setNotifications(prev => [newNotification, ...prev]);
              if (!newNotification.is_read) {
                setUnreadCount(prev => prev + 1);
              }
            }
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedNotification = payload.new as Notification;
            
            // Update the notification in our list
            setNotifications(prev => 
              prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
            );
            
            // If a notification was marked as read, update the count
            if (payload.old.is_read === false && updatedNotification.is_read === true) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();
    
    // Store the subscription reference
    subscriptionRef.current = subscription;
    
    // Fetch initial data
    fetchNotifications();
    fetchUnreadCount();
    
    // Clean up subscription when component unmounts or homeId/user changes
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user, homeId, fetchNotifications, fetchUnreadCount]);
  
  // Return everything needed by components
  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    refreshNotifications: fetchNotifications, // Alias for consistency
    markAsRead,
    markAllAsRead
  };
};

export default useNotifications;
