import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Notification } from '../services/api/notificationService';

interface NotificationDisplayProps {
  notification: Notification | null;
  onDismiss: () => void;
  onNotificationPress?: (notification: Notification) => void;
  autoHideDuration?: number;
}

const NotificationDisplay: React.FC<NotificationDisplayProps> = ({
  notification,
  onDismiss,
  onNotificationPress,
  autoHideDuration = 5000,
}) => {
  const { theme, isDarkMode } = useTheme();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get icon based on notification level
  const getIcon = (level: string) => {
    switch (level) {
      case 'success':
        return 'checkmark-circle-outline';
      case 'warning':
        return 'warning-outline';
      case 'error':
        return 'alert-circle-outline';
      case 'info':
      default:
        return 'information-circle-outline';
    }
  };

  // Get color based on notification level
  const getColor = (level: string) => {
    switch (level) {
      case 'success':
        return '#20BF6B';
      case 'warning':
        return '#F7B731';
      case 'error':
        return '#EB4D4B';
      case 'info':
      default:
        return '#546DE5';
    }
  };

  // Handle showing the notification
  useEffect(() => {
    if (notification) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Show notification with animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Hide after duration
      timeoutRef.current = setTimeout(() => {
        hideNotification();
      }, autoHideDuration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [notification]);

  // Hide the notification with animation
  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!notification) return null;

  const notificationColor = getColor(notification.level);
  const notificationIcon = getIcon(notification.level);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#222' : '#fff',
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.contentContainer}
        onPress={() => {
          if (onNotificationPress && notification) {
            onNotificationPress(notification);
          }
          hideNotification();
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: notificationColor + '20' }]}>
          <Ionicons name={notificationIcon} size={24} color={notificationColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {notification.title}
          </Text>
          <Text style={[styles.message, { color: isDarkMode ? '#bbb' : '#666' }]} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={hideNotification}>
          <Ionicons name="close" size={20} color={isDarkMode ? '#999' : '#666'} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
  },
  closeButton: {
    padding: 6,
  },
});

export default NotificationDisplay;
