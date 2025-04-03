import React, { createContext, useState, useContext, useRef, useEffect } from 'react';
import DynamicIsland from '../components/DynamicIsland';
import { logDebug } from '../utils/DebugHelper';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

type NotificationContextType = {
  showNotification: (title: string, message: string, type: NotificationType, duration?: number) => void;
  hideNotification: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use refs to track if we've already mounted to prevent animation on first render
  const isMounted = useRef(false);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [notification, setNotification] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as NotificationType,
  });

  // Clear any existing timeouts when unmounting
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Hide the notification
  const hideNotification = () => {
    if (!isMounted.current) return;
    
    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
    
    setNotification(prev => ({ ...prev, visible: false }));
  };

  // Show a notification
  const showNotification = (
    title: string, 
    message: string, 
    type: NotificationType = 'info',
    duration: number = 3000
  ) => {
    if (!isMounted.current) return;
    
    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
    
    // Update notification state
    setNotification({ visible: true, title, message, type });
    
    // Auto-hide notification after duration if specified
    if (duration > 0) {
      notificationTimeoutRef.current = setTimeout(hideNotification, duration);
    }
    
    logDebug(`Showing notification: ${title} (${type})`);
  };

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      <DynamicIsland
        visible={notification.visible}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onHide={hideNotification}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
