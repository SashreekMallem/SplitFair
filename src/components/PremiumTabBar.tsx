import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const PremiumTabBar: React.FC<BottomTabBarProps> = ({ 
  state, 
  descriptors, 
  navigation 
}) => {
  const { theme, isDarkMode } = useTheme();
  const tabWidth = width / state.routes.length;
  
  // Animation for the active indicator
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const floatingScale = useRef(new Animated.Value(1)).current;
  
  // Icon animations
  const iconScales = useRef(state.routes.map(() => new Animated.Value(1))).current;
  
  // Animate the indicator position when the active tab changes
  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: state.index * tabWidth,
      tension: 70,
      friction: 9,
      useNativeDriver: true
    }).start();
    
    // Animate icon scales
    state.routes.forEach((_, i) => {
      Animated.spring(iconScales[i], {
        toValue: i === state.index ? 1.2 : 1,
        tension: 300,
        friction: 20,
        useNativeDriver: true
      }).start();
    });
    
    // Pulse animation for the active tab
    Animated.sequence([
      Animated.timing(floatingScale, {
        toValue: 1.08,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(floatingScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  }, [state.index]);
  
  // Get icon information for a route
  const getTabIcon = (routeName: string, isFocused: boolean) => {
    let iconName: string;
    
    switch (routeName) {
      case 'Home':
        iconName = isFocused ? 'home' : 'home-outline';
        break;
      case 'Expenses':
        iconName = isFocused ? 'card' : 'card-outline';
        break;
      case 'Items':
        iconName = isFocused ? 'cube' : 'cube-outline';
        break;
      case 'Sanitization':
        iconName = isFocused ? 'water' : 'water-outline';
        break;
      case 'Profile':
        iconName = isFocused ? 'person' : 'person-outline';
        break;
      default:
        iconName = 'apps-outline';
    }
    
    return iconName;
  };
  
  // Get theme colors for the active tab
  const getTabColors = (index: number) => {
    // Different colors for different tabs
    const tabThemes = [
      { // Home
        gradient: isDarkMode ? ['#142949', '#2E4D8E'] : ['#2952A3', '#4A77D1'], 
        icon: '#4A77D1'
      },
      { // Expenses
        gradient: isDarkMode ? ['#5D1A1F', '#9C2A33'] : ['#9C2A33', '#E14856'], 
        icon: '#E14856'
      },
      { // Items 
        gradient: isDarkMode ? ['#3E2A63', '#6441A5'] : ['#6441A5', '#9F71ED'], 
        icon: '#9F71ED'
      },
      { // Sanitization
        gradient: isDarkMode ? ['#0E3B2E', '#1D6852'] : ['#147257', '#2EAF89'], 
        icon: '#2EAF89'
      },
      { // Profile
        gradient: isDarkMode ? ['#523B0A', '#8F6A1C'] : ['#B3841A', '#E2AB2E'], 
        icon: '#E2AB2E'
      }
    ];
    
    return tabThemes[index] || tabThemes[0];
  };
  
  return (
    <View style={[styles.container, { 
      backgroundColor: isDarkMode ? 'rgba(22, 22, 22, 0.85)' : 'rgba(255, 255, 255, 0.85)'
    }]}>
      <BlurView 
        intensity={90} 
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.blurView}
      >
        {/* Animated indicator for the active tab */}
        <Animated.View 
          style={[
            styles.activeIndicator, 
            {
              transform: [{ translateX: indicatorPosition }],
              width: tabWidth,
            }
          ]}
        >
          <LinearGradient
            colors={getTabColors(state.index).gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.indicatorGradient}
          />
        </Animated.View>
        
        <View style={styles.tabsContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel as string || options.title || route.name;
            const isFocused = state.index === index;
            const iconName = getTabIcon(route.name, isFocused);
            const { icon: iconColor } = getTabColors(index);
            
            // Handle press events
            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };
            
            return (
              <TouchableOpacity
                key={index}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                style={styles.tab}
                activeOpacity={0.7}
              >
                {/* Tab Icon with Animation */}
                <Animated.View style={[
                  styles.tabIconContainer,
                  {
                    backgroundColor: isFocused ? `${iconColor}20` : 'transparent',
                    transform: [{ scale: iconScales[index] }]
                  }
                ]}>
                  <Ionicons
                    name={iconName as any}
                    size={24}
                    color={isFocused ? iconColor : isDarkMode ? '#999' : '#777'}
                  />
                </Animated.View>
                
                {/* Tab Label */}
                <Text style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? iconColor : isDarkMode ? '#999' : '#777',
                    opacity: isFocused ? 1 : 0.8
                  }
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 16,
    left: 16,
    right: 16,
    height: 76,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  blurView: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  activeIndicator: {
    position: 'absolute',
    height: '100%',
    borderRadius: 20,
  },
  indicatorGradient: {
    height: '100%',
    width: '100%',
    opacity: 0.15,
    borderRadius: 20,
  },
});

export default PremiumTabBar;
