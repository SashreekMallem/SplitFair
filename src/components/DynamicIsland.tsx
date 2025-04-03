import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

type DynamicIslandProps = {
  title?: string;
  message?: string;
  icon?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  action?: () => void;
  actionText?: string;
  visible: boolean;
  onHide?: () => void;
  animated?: boolean;
};

const DynamicIsland: React.FC<DynamicIslandProps> = ({
  title,
  message,
  icon,
  type = 'info',
  action,
  actionText,
  visible,
  onHide,
  animated = true,
}) => {
  const { theme } = useTheme();
  
  // Prevent animation issues by using refs and creating animations for each render cycle
  const [animatedValues] = useState(() => ({
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0)
  }));

  // Track if we've animated once to avoid issues on reload
  const hasAnimated = useRef(false);
  
  // Use state instead of animated value for height to avoid mixing native/non-native
  const [expanded, setExpanded] = useState(false);
  
  // Get color based on type
  const getTypeColor = () => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      case 'info':
      default:
        return theme.colors.primary;
    }
  };

  // Get icon based on type
  const getTypeIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  // Animation sequences
  useEffect(() => {
    // Avoid animation on first render after reload
    if (!hasAnimated.current && !visible) {
      hasAnimated.current = true;
      return;
    }
    
    if (visible) {
      // First update the height state
      setExpanded(message != null && message.length > 0);
      
      // Reset animations to avoid conflicts
      animatedValues.scale.setValue(0.8);
      animatedValues.opacity.setValue(0);
      
      // Then animate opacity and scale with native driver
      Animated.parallel([
        Animated.spring(animatedValues.scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues.opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else if (hasAnimated.current) {
      // Animate out
      Animated.parallel([
        Animated.timing(animatedValues.scale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValues.opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Update height state after animation completes
        setExpanded(false);
      });
    }
    
    hasAnimated.current = true;
  }, [visible, message]);

  if (!visible && !animated) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        expanded && styles.expandedContainer,
        {
          opacity: animatedValues.opacity,
          transform: [{ scale: animatedValues.scale }],
          shadowColor: getTypeColor(),
        },
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blurView}>
        <View style={[styles.content, expanded && styles.expandedContent]}>
          <View style={styles.leftContent}>
            <View style={[styles.iconContainer, { backgroundColor: getTypeColor() }]}>
              <Ionicons name={getTypeIcon() as any} size={20} color="white" />
            </View>
            <View style={styles.textContainer}>
              {title && <Text style={styles.title}>{title}</Text>}
              {message && expanded && <Text style={styles.message}>{message}</Text>}
            </View>
          </View>
          {actionText && action && (
            <TouchableOpacity onPress={action} style={styles.actionButton}>
              <Text style={[styles.actionText, { color: getTypeColor() }]}>{actionText}</Text>
            </TouchableOpacity>
          )}
          {onHide && (
            <TouchableOpacity onPress={onHide} style={styles.closeButton}>
              <Ionicons name="close" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    width: width - 40,
    height: 50, // Base height
    borderRadius: 25,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  expandedContainer: {
    height: 90, // Expanded height with message
  },
  blurView: {
    flex: 1,
    borderRadius: 25,
    backgroundColor: 'rgba(40, 40, 40, 0.7)',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  expandedContent: {
    alignItems: 'flex-start',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Changed from center to support multiline text
    flex: 1,
    paddingTop: 4,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#546DE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -2, // Adjust alignment 
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default DynamicIsland;
