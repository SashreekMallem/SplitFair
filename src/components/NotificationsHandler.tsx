import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useNotifications } from '../hooks/useNotifications';
import { Notification } from '../services/api/notificationService';

/**
 * Component to handle notifications at the app level
 * This must be rendered inside NotificationProvider
 */
const NotificationsHandler: React.FC = () => {
  const { user } = useAuth();
  const homeId = user?.user_metadata?.home_id;
  const { notifications, unreadCount, markAsRead } = useNotifications(homeId);
  const { showPushNotification } = useNotification();
  
  // Track app state to handle notifications differently when app in foreground vs background
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  
  // Track processed notifications to avoid duplicates
  const processedNotifications = useRef<Set<string>>(new Set());
  
  // Sound handling
  const playNotificationSound = async () => {
    try {
      console.log('Playing notification sound');
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/notification.mp3')
      );
      await sound.playAsync();
      
      // Unload sound after playing to prevent memory leaks
      setTimeout(() => {
        sound.unloadAsync();
      }, 2000);
      
    } catch (error) {
      console.log('Error playing notification sound:', error);
    }
  };
  
  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
      setAppStateVisible(nextAppState);
      
      // When app comes to the foreground, refresh notifications
      if (nextAppState === 'active' && homeId) {
        console.log('App has come to the foreground, refreshing notifications');
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [homeId]);
  
  // Display new notifications as they arrive
  useEffect(() => {
    if (notifications.length > 0) {
      // Find the most recent unread notification
      const latestUnread = notifications.find(n => !n.is_read && !processedNotifications.current.has(n.id));
      
      if (latestUnread) {
        console.log('Processing new notification:', latestUnread.title);
        
        // Add to processed set to avoid showing it again
        processedNotifications.current.add(latestUnread.id);
        
        // Mark as read and show it
        markAsRead(latestUnread.id);
        showPushNotification(latestUnread);
        
        // Play sound when the app is in foreground
        if (appStateVisible === 'active') {
          playNotificationSound();
        }
      }
    }
  }, [notifications, markAsRead, showPushNotification, appStateVisible]);

  // This component doesn't render anything visually
  return null;
};

export default NotificationsHandler;
