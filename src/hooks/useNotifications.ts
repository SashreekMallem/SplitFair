import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as notificationService from '../services/api/notificationService';
import { Notification } from '../services/api/notificationService';
import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const useNotifications = (homeId?: string) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference to the realtime subscription
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  // Track the last seen notification to prevent duplicates
  const lastSeenNotificationRef = useRef<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (limit: number = 20, offset: number = 0) => {
    if (!user?.id || !homeId) {
      return;
    }
    
    setLoading(true);
    try {
      const data = await notificationService.getUserNotifications(user.id, homeId, limit, offset);
      
      // Update the last seen notification ID if we have notifications
      if (data.length > 0) {
        lastSeenNotificationRef.current = data[0].id;
      }
      
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
  
  // Handle a new notification
  const handleNewNotification = useCallback((newNotification: Notification) => {
    // Only process if it's for this user or all users (null user_id)
    if (
      (newNotification.user_id === user?.id || newNotification.user_id === null) &&
      // Prevent duplicate notifications by checking against last seen ID
      newNotification.id !== lastSeenNotificationRef.current
    ) {
      console.log(`Processing notification: ${newNotification.id} - ${newNotification.title}`);
      
      // Update last seen ID
      lastSeenNotificationRef.current = newNotification.id;
      
      // Add to the list
      setNotifications(prev => {
        // Check if this notification already exists to avoid duplicates
        const exists = prev.some(n => n.id === newNotification.id);
        if (exists) {
          return prev;
        }
        return [newNotification, ...prev];
      });
      
      // Update unread count if needed
      if (!newNotification.is_read) {
        setUnreadCount(prev => prev + 1);
      }
      
      return true;
    }
    return false;
  }, [user]);
  
  // Set up realtime subscription with improved error handling
  useEffect(() => {
    if (!user?.id || !homeId) {
      return;
    }
    
    console.log(`Setting up notification subscription for homeId: ${homeId} and userId: ${user.id}`);
    
    // Clean up any existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    
    // Create a new subscription with more detailed filter
    const channelName = `notifications-${Platform.OS}-${Date.now()}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (insert, update, delete)
          schema: 'public',
          table: 'notifications',
          filter: `home_id=eq.${homeId}` // Filter for this specific home
        },
        (payload) => {
          console.log(`Realtime notification received on ${Platform.OS}:`, payload);
          
          // Handle different event types
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification;
            handleNewNotification(newNotification);
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
      .subscribe((status) => {
        console.log(`Notification subscription status (${channelName}):`, status);
      });
    
    // Store the subscription reference
    subscriptionRef.current = subscription;
    
    // Fetch initial data
    fetchNotifications();
    fetchUnreadCount();
    
    // Refresh data periodically as a backup mechanism
    const refreshInterval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // Every 30 seconds
    
    // Clean up subscription when component unmounts or homeId/user changes
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      clearInterval(refreshInterval);
    };
  }, [user, homeId, fetchNotifications, fetchUnreadCount, handleNewNotification]);
  
  // Return everything needed by components
  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    refreshNotifications: fetchNotifications,
    markAsRead,
    markAllAsRead
  };
};

export default useNotifications;
