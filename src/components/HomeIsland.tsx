import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

const { width } = Dimensions.get('window');

// Different possible modes for the island
export type IslandMode = 'summary' | 'expenses' | 'tasks' | 'schedule' | 'furniture' | 'alert' | 'notification';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Map to help with cycling through modes
const MODE_CYCLE: Record<IslandMode, IslandMode> = {
  'summary': 'expenses',
  'expenses': 'tasks',
  'tasks': 'schedule',
  'schedule': 'furniture',
  'furniture': 'alert',
  'alert': 'summary',
  'notification': 'summary'
};

type HomeIslandProps = {
  mode: IslandMode;
  onModeChange: (mode: IslandMode) => void;
  onActionPress: () => void;
  data?: any;
};

const HomeIsland: React.FC<HomeIslandProps> = ({
  mode,
  onModeChange,
  onActionPress,
  data
}) => {
  const { theme, isDarkMode } = useTheme();
  const { currentNotification, hideNotification } = useNotification();
  const [expanded, setExpanded] = useState(false);
  const [currentDataIndex, setCurrentDataIndex] = useState(0);
  const expandAnimation = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  
  // Track content height for dynamic sizing
  const [contentHeight, setContentHeight] = useState(0);
  
  // Store previous mode to return to after notification
  const [previousMode, setPreviousMode] = useState<IslandMode>('summary');
  
  // Add onLayout handler to measure content
  const onContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setContentHeight(height);
  };
  
  // Handle notification display
  useEffect(() => {
    if (currentNotification) {
      // Save current mode to return to when notification is dismissed
      if (mode !== 'notification') {
        setPreviousMode(mode);
      }
      
      // Switch to notification mode and show expanded island
      onModeChange('notification');
      setExpanded(true);
    }
  }, [currentNotification]);

  // Handle notification dismissal
  const handleNotificationDismiss = () => {
    if (mode === 'notification') {
      // Return to previous mode
      onModeChange(previousMode);
      setExpanded(false);
      hideNotification();
    }
  };
  
  // Setup pulse animation for highlight effect
  useEffect(() => {
    const startPulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        })
      ]).start(startPulseAnimation);
    };
    
    startPulseAnimation();
  }, []);
  
  // Update data periodically to simulate live updates
  useEffect(() => {
    const dataUpdateInterval = setInterval(() => {
      if (expanded) {
        // Only update data when expanded
        setCurrentDataIndex(prev => (prev + 1) % 3);
      }
    }, 5000);
    
    return () => clearInterval(dataUpdateInterval);
  }, [expanded]);
  
  useEffect(() => {
    // Reset initial state when mode changes (except for notifications)
    if (mode !== 'notification') {
      setExpanded(false);
      Animated.timing(expandAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false
      }).start();
      
      Animated.timing(iconRotation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
    
    // Animation for mode change
    Animated.sequence([
      Animated.timing(slideAnimation, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();
  }, [mode]);
  
  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal gestures when not in notification mode
        return mode !== 'notification' && 
               Math.abs(gestureState.dx) > 5 && 
               Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (mode === 'notification') return;
        
        if (gestureState.dx < -50) {
          // Swipe left -> next mode
          onModeChange(MODE_CYCLE[mode]);
        } else if (gestureState.dx > 50) {
          // Swipe right -> previous mode
          const prevMode = Object.entries(MODE_CYCLE).find(([_, next]) => next === mode)?.[0] as IslandMode;
          if (prevMode) {
            onModeChange(prevMode);
          }
        }
      }
    })
  ).current;
  
  const toggleExpand = () => {
    // Don't allow collapsing notifications with toggle
    if (mode === 'notification') {
      handleNotificationDismiss();
      return;
    }
    
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    Animated.spring(expandAnimation, {
      toValue: newExpanded ? 1 : 0,
      friction: 7,
      tension: 70,
      useNativeDriver: false
    }).start();
    
    Animated.timing(iconRotation, {
      toValue: newExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true
    }).start();
  };
  
  // Calculate dynamic expanded height based on content height
  const getDynamicHeight = () => {
    if (contentHeight > 0) {
      // Header height (56) + measured content height + padding/margins (30)
      return 56 + contentHeight + 70; // 70px for bottom buttons and padding
    }
    
    // Default heights if content hasn't been measured yet
    switch(mode) {
      case 'notification': return 140; // Smaller height for notifications
      case 'summary': return 220;
      case 'expenses': return 230;
      case 'tasks': return 240;
      case 'schedule': return 230;
      case 'furniture': return 220;
      case 'alert': return 210;
      default: return 220;
    }
  };
  
  const expandedHeight = expandAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [56, getDynamicHeight()]
  });
  
  const rotate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });
  
  // Get notification icon based on type
  const getNotificationIcon = (type?: NotificationType) => {
    switch(type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'warning': return 'warning';
      case 'info':
      default: return 'information-circle';
    }
  };
  
  // Get notification colors
  const getNotificationColors = (type?: NotificationType) => {
    switch(type) {
      case 'success':
        return isDarkMode
          ? { gradient: ['#0E3B2E', '#114D3C', '#1D6852'], accent: '#2EAF89', text: '#E0F5EF' }
          : { gradient: ['#147257', '#1D8F6E', '#2EAF89'], accent: '#7ADFC1', text: '#FFFFFF' };
      case 'error':
        return isDarkMode
          ? { gradient: ['#5D1A1F', '#7A1F26', '#9C2A33'], accent: '#E14856', text: '#FDE7E9' }
          : { gradient: ['#9C2A33', '#C13440', '#E14856'], accent: '#FF9AA2', text: '#FFFFFF' };
      case 'warning':
        return isDarkMode
          ? { gradient: ['#523B0A', '#6D4E0D', '#8F6A1C'], accent: '#E2AB2E', text: '#FBF3E0' }
          : { gradient: ['#B3841A', '#CC9621', '#E2AB2E'], accent: '#FFD980', text: '#FFFFFF' };
      case 'info':
      default:
        return isDarkMode 
          ? { gradient: ['#142949', '#1D3A6E', '#2E4D8E'], accent: '#4A77D1', text: '#E0E6F5' }
          : { gradient: ['#2952A3', '#3A66BD', '#4A77D1'], accent: '#8AADF3', text: '#FFFFFF' };
    }
  };
  
  // Premium color schemes for each mode
  const getPremiumColors = (modeType: IslandMode) => {
    if (modeType === 'notification' && currentNotification) {
      return getNotificationColors(currentNotification.type);
    }
    
    switch(modeType) {
      case 'summary':
        return isDarkMode 
          ? { gradient: ['#142949', '#1D3A6E', '#2E4D8E'], accent: '#4A77D1', text: '#E0E6F5' }
          : { gradient: ['#2952A3', '#3A66BD', '#4A77D1'], accent: '#8AADF3', text: '#FFFFFF' };
      case 'expenses':
        return isDarkMode
          ? { gradient: ['#5D1A1F', '#7A1F26', '#9C2A33'], accent: '#E14856', text: '#FDE7E9' }
          : { gradient: ['#9C2A33', '#C13440', '#E14856'], accent: '#FF9AA2', text: '#FFFFFF' };
      case 'tasks':
        return isDarkMode
          ? { gradient: ['#0E3B2E', '#114D3C', '#1D6852'], accent: '#2EAF89', text: '#E0F5EF' }
          : { gradient: ['#147257', '#1D8F6E', '#2EAF89'], accent: '#7ADFC1', text: '#FFFFFF' };
      case 'schedule':
        return isDarkMode
          ? { gradient: ['#523B0A', '#6D4E0D', '#8F6A1C'], accent: '#E2AB2E', text: '#FBF3E0' }
          : { gradient: ['#B3841A', '#CC9621', '#E2AB2E'], accent: '#FFD980', text: '#FFFFFF' };
      case 'furniture':
        return isDarkMode
          ? { gradient: ['#3E2A63', '#513380', '#6441A5'], accent: '#9F71ED', text: '#F0E6FF' }
          : { gradient: ['#6441A5', '#7B56C2', '#9F71ED'], accent: '#C7AEFF', text: '#FFFFFF' };
      case 'alert':
        return isDarkMode
          ? { gradient: ['#5C1428', '#7A1935', '#A32247'], accent: '#EB5982', text: '#FDECF2' }
          : { gradient: ['#A32247', '#C7295A', '#EB5982'], accent: '#FFA5C0', text: '#FFFFFF' };
      default:
        return isDarkMode 
          ? { gradient: ['#142949', '#1D3A6E', '#2E4D8E'], accent: '#4A77D1', text: '#E0E6F5' }
          : { gradient: ['#2952A3', '#3A66BD', '#4A77D1'], accent: '#8AADF3', text: '#FFFFFF' };
    }
  };
  
  // Mock data for different data points to show cycling information
  const getMockData = (modeType: IslandMode, dataIndex: number) => {
    const data: Record<IslandMode, { primary: string; secondary: string }[]> = {
      summary: [
        { primary: '$124.50', secondary: 'You owe' },
        { primary: '$215.75', secondary: 'You\'re owed' },
        { primary: '3 tasks', secondary: 'Due this week' },
      ],
      expenses: [
        { primary: 'Internet Bill', secondary: '$89.99 due tomorrow' },
        { primary: 'Grocery Shopping', secondary: '$124.56 split with 3 people' },
        { primary: 'Water & Utilities', secondary: '$45.00 paid by Jordan' },
      ],
      tasks: [
        { primary: 'Kitchen Cleaning', secondary: 'Due today' },
        { primary: 'Bathroom', secondary: 'Due tomorrow' },
        { primary: 'Living Room', secondary: 'Due in 2 days' },
      ],
      schedule: [
        { primary: 'Rent Payment', secondary: 'Due in 12 days' },
        { primary: 'House Meeting', secondary: 'November 22, 7:00 PM' },
        { primary: 'Plumber Visit', secondary: 'November 19, 10:00 AM' },
      ],
      furniture: [
        { primary: 'Living Room Couch', secondary: 'Shared with 3 people' },
        { primary: 'Coffee Machine', secondary: 'Owned by you' },
        { primary: 'Dining Table', secondary: 'Owned by Jordan' },
      ],
      alert: [
        { primary: 'Internet Bill Due', secondary: '$89.99 tomorrow' },
        { primary: 'Rent Payment', secondary: '$1,420.00 in 12 days' },
        { primary: 'Water Bill Overdue', secondary: '$45.00 yesterday' },
      ],
      notification: [
        { primary: 'New Message', secondary: 'Alex sent you a message' },
        { primary: 'Reminder', secondary: 'Meeting at 7:00 PM' },
        { primary: 'Update', secondary: 'Your balance has been updated' },
      ]
    };
    
    // Return appropriate data or fallback to a default
    return data[modeType]?.[dataIndex % 3] || { primary: 'No data', secondary: 'Check back later' };
  };
  
  // Get island data based on mode
  const getIslandContent = () => {
    const colors = getPremiumColors(mode);
    
    // Handle notification mode
    if (mode === 'notification' && currentNotification) {
      return {
        title: currentNotification.title || 'Notification',
        icon: getNotificationIcon(currentNotification.type),
        color: colors.accent,
        gradient: colors.gradient,
        primaryText: currentNotification.title || '',
        secondaryText: currentNotification.message || '',
        actionText: 'Dismiss'
      };
    }
    
    // For standard modes, use mock data
    const currentData = getMockData(mode, currentDataIndex);
    
    switch(mode) {
      case 'summary':
        return {
          title: 'Home Summary',
          icon: 'home',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'View Details'
        };
      case 'expenses':
        return {
          title: 'Expenses',
          icon: 'card',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'Pay Now'
        };
      case 'tasks':
        return {
          title: 'Cleaning Tasks',
          icon: 'water',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'Complete Task'
        };
      case 'schedule':
        return {
          title: 'Schedule',
          icon: 'calendar',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'Add Reminder'
        };
      case 'furniture':
        return {
          title: 'Shared Items',
          icon: 'cube',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'Add Item'
        };
      case 'alert':
        return {
          title: 'Payment Due',
          icon: 'alert-circle',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'Resolve Now'
        };
      case 'notification':
        return {
          title: 'Notifications',
          icon: 'notifications',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'View Notification'
        };
      default:
        return {
          title: 'SplitFair',
          icon: 'home',
          color: colors.accent,
          gradient: colors.gradient,
          primaryText: currentData.primary,
          secondaryText: currentData.secondary,
          actionText: 'View Details'
        };
    }
  };
  
  // Render notification content
  const renderNotificationContent = () => {
    if (!currentNotification) return null;
    
    const colors = getPremiumColors('notification');
    
    return (
      <View style={styles.expandedContent} onLayout={onContentLayout}>
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationMessage, { color: colors.text }]}>
            {currentNotification.message}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.actionButton, {backgroundColor: colors.accent}]}
          onPress={handleNotificationDismiss}
        >
          <Text style={styles.actionButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Content for the expanded state with onLayout to measure content
  const renderExpandedContent = () => {
    // If we're in notification mode, show notification content
    if (mode === 'notification') {
      return renderNotificationContent();
    }
    
    // Otherwise show regular content
    switch(mode) {
      case 'summary':
        return (
          <View style={styles.expandedContent} onLayout={onContentLayout}>
            <View style={styles.richDataCard}>
              <View style={styles.dataCardHeader}>
                <Text style={[styles.dataCardTitle, {color: colors.text}]}>Your Balance</Text>
                <View style={[styles.dataCardBadge, {backgroundColor: colors.accent}]}>
                  <Text style={styles.dataCardBadgeText}>Updated</Text>
                </View>
              </View>
              
              <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, {color: colors.text}]}>$124.50</Text>
                  <Text style={[styles.statLabel, {color: `${colors.text}99`}]}>You Owe</Text>
                </View>
                <View style={[styles.statDivider, {backgroundColor: `${colors.text}33`}]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, {color: colors.text}]}>$215.75</Text>
                  <Text style={[styles.statLabel, {color: `${colors.text}99`}]}>You're Owed</Text>
                </View>
                <View style={[styles.statDivider, {backgroundColor: `${colors.text}33`}]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, {color: colors.text}]}>+$91.25</Text>
                  <Text style={[styles.statLabel, {color: `${colors.text}99`}]}>Net</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.actionButton, {backgroundColor: colors.accent}]}
              onPress={onActionPress}
            >
              <Text style={styles.actionButtonText}>{content.actionText}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" style={styles.actionButtonIcon} />
            </TouchableOpacity>
          </View>
        );
        
      default:
        return (
          <View style={styles.expandedContent} onLayout={onContentLayout}>
            <View style={styles.richDataCard}>
              <View style={styles.dataCardHeader}>
                <Text style={[styles.dataCardTitle, {color: colors.text}]}>{content.title}</Text>
              </View>
              <View style={styles.placeholderContent}>
                <Text style={[styles.placeholderText, {color: `${colors.text}DD`}]}>
                  {content.primaryText}
                </Text>
                <Text style={[styles.placeholderSubtext, {color: `${colors.text}99`}]}>
                  {content.secondaryText}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.actionButton, {backgroundColor: colors.accent}]}
              onPress={onActionPress}
            >
              <Text style={styles.actionButtonText}>{content.actionText}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" style={styles.actionButtonIcon} />
            </TouchableOpacity>
          </View>
        );
    }
  };

  // Quick access mode buttons for bottom of expanded island
  const renderQuickModeButtons = () => {
    // Don't show mode buttons for notifications
    if (mode === 'notification') return null;
    
    const modes: {mode: IslandMode, icon: string, label: string}[] = [
      {mode: 'summary', icon: 'home', label: 'Home'},
      {mode: 'expenses', icon: 'card', label: 'Expenses'},
      {mode: 'tasks', icon: 'water', label: 'Tasks'},
      {mode: 'schedule', icon: 'calendar', label: 'Schedule'},
      {mode: 'alert', icon: 'alert-circle', label: 'Alerts'},
      {mode: 'notification', icon: 'notifications', label: 'Notifications'},
    ];
    
    return (
      <View style={[styles.quickAccessContainer, {borderTopColor: `${colors.text}22`}]}>
        {modes.map((item) => {
          const isActive = mode === item.mode;
          return (
            <TouchableOpacity 
              key={item.mode}
              style={styles.modeButton}
              onPress={() => onModeChange(item.mode)}
            >
              <View style={[
                styles.modeButtonIconWrapper,
                isActive && {backgroundColor: colors.accent}
              ]}>
                <Ionicons 
                  name={item.icon as any} 
                  size={16} 
                  color={isActive ? '#fff' : `${colors.text}99`} 
                />
              </View>
              <Text style={[
                styles.modeButtonLabel, 
                {color: isActive ? colors.text : `${colors.text}99`}
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const content = getIslandContent();
  const colors = getPremiumColors(mode);
  
  // Dynamic shadow based on mode
  const getShadowStyle = () => {
    return {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: expanded ? 8 : 4 },
      shadowOpacity: expanded ? 0.4 : 0.2,
      shadowRadius: expanded ? 15 : 8,
      elevation: expanded ? 12 : 8,
    };
  };
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { height: expandedHeight },
        getShadowStyle()
      ]}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={colors.gradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.gradient}
      >
        <BlurView intensity={expanded ? 20 : 0} tint="dark" style={styles.blurView}>
          {/* Collapsed Island Content */}
          <Animated.View
            style={[
              styles.collapsedContent,
              { transform: [{ translateX: slideAnimation }] }
            ]}
          >
            <TouchableOpacity
              style={styles.mainContentButton}
              onPress={toggleExpand}
              activeOpacity={0.9}
            >
              <View style={styles.leftContent}>
                <Animated.View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: colors.accent, transform: [{ scale: pulseAnimation }] }
                  ]}
                >
                  <Ionicons name={content.icon as any} size={20} color="#fff" />
                </Animated.View>
                <View style={styles.textContainer}>
                  <Text style={styles.titleText} numberOfLines={1}>{content.title}</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, {backgroundColor: colors.accent}]} />
                    <Text style={styles.statusText} numberOfLines={1}>
                      {content.primaryText}
                    </Text>
                  </View>
                </View>
              </View>
              
              <Animated.View style={{transform: [{ rotate }]}}>
                <Ionicons 
                  name={expanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={colors.text} 
                />
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
          
          {/* Expanded Content with Animation */}
          {expanded && (
            <>
              {renderExpandedContent()}
              {renderQuickModeButtons()}
            </>
          )}
        </BlurView>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width - 40,
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    zIndex: 1000,
    position: 'absolute',
  },
  gradient: {
    flex: 1,
    borderRadius: 28,
  },
  blurView: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  collapsedContent: {
    height: 56,
    width: '100%',
  },
  mainContentButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    maxWidth: width - 140, // Prevent text from overflowing
  },
  titleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  expandedContent: {
    padding: 16,
    paddingTop: 8,
  },
  richDataCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 14,
    marginBottom: 12,
  },
  dataCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dataCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  dataCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dataCardBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '70%',
  },
  actionButton: {
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonIcon: {
    marginLeft: 6,
  },
  quickAccessContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    paddingBottom: 4,
  },
  modeButton: {
    alignItems: 'center',
  },
  modeButtonIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeButtonLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  notificationContent: {
    padding: 10,
    alignItems: 'center',
  },
  notificationMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
});

export default HomeIsland;
