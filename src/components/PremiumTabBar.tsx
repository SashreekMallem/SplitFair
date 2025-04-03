import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const PremiumTabBar: React.FC<BottomTabBarProps> = ({ 
  state, 
  descriptors, 
  navigation 
}) => {
  const { isDarkMode } = useTheme();
  const [pressed, setPressed] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: width - 40, height: 85 });
  
  // Animation refs
  const tabAnimations = useRef(state.routes.map(() => new Animated.Value(0))).current;
  const centerButtonScale = useRef(new Animated.Value(1)).current;
  const centerButtonRotation = useRef(new Animated.Value(0)).current;
  const barHeight = useRef(new Animated.Value(85)).current;
  const highlightPosition = useRef(new Animated.Value(dimensions.width / 2)).current;
  const highlightScale = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Animate tab indicator
    tabAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: index === state.index ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
    
    // Calculate highlight position based on tab index
    const tabWidth = dimensions.width / state.routes.length;
    const newPosition = tabWidth * (state.index + 0.5);
    
    Animated.spring(highlightPosition, {
      toValue: newPosition,
      tension: 60,
      friction: 10,
      useNativeDriver: false,
    }).start();
    
    // Scale highlight in
    Animated.sequence([
      Animated.timing(highlightScale, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(highlightScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
    
    // If center tab is selected, animate the center button
    const addTabIndex = state.routes.findIndex(route => route.name === "Add");
    if (state.index === addTabIndex) {
      Animated.sequence([
        Animated.timing(centerButtonScale, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(centerButtonScale, {
          toValue: 1,
          tension: 50,
          friction: 4,
          useNativeDriver: false,
        }),
      ]).start();
      
      // Rotate button
      Animated.timing(centerButtonRotation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }).start();
    } else {
      // Reset rotation when not selected
      Animated.timing(centerButtonRotation, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }
  }, [state.index]);
  
  // Tab button press handling
  const handleTabPress = (route: any, index: number) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    
    setPressed(index);
    setTimeout(() => setPressed(null), 200);
    
    if (!event.defaultPrevented) {
      // Animate bar height on press for a bouncy effect
      Animated.sequence([
        Animated.timing(barHeight, {
          toValue: 75,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.spring(barHeight, {
          toValue: 85,
          tension: 80,
          friction: 5,
          useNativeDriver: false,
        })
      ]).start();
      
      navigation.navigate(route.name);
    }
  };
  
  // Render center floating button (no longer tied to a specific tab)
  const renderCenterButton = () => {
    const rotation = centerButtonRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });
    
    // Colors for center button
    const buttonColors = isDarkMode
      ? ['#EB4D4B', '#C13440'] // Red theme for dark mode
      : ['#FF6B6B', '#E14856']; // Red gradient for light mode
      
    return (
      <Animated.View 
        style={[
          styles.centerButtonContainer, 
          { 
            transform: [
              { scale: centerButtonScale },
              { rotate: rotation }
            ] 
          }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            // Show a modal or handle special action
            console.log("Add button pressed");
          }}
          style={styles.centerButton}
        >
          <LinearGradient
            colors={buttonColors}
            style={styles.centerButtonGradient}
          >
            <Ionicons 
              name="add" 
              size={32} 
              color="#FFFFFF"
            />
          </LinearGradient>
          
          {/* Inner glow effect */}
          <View style={styles.centerButtonGlow} />
        </TouchableOpacity>
      </Animated.View>
    );
  };
  
  // Get icon for tab
  const getTabIcon = (routeName: string, isFocused: boolean) => {
    let iconName: string;
    
    switch (routeName) {
      case 'Home':
        iconName = isFocused ? 'home' : 'home-outline';
        break;
      case 'Schedule':
        iconName = isFocused ? 'calendar' : 'calendar-outline';
        break;
      case 'Expenses':
        iconName = isFocused ? 'wallet' : 'wallet-outline';
        break;
      case 'Furniture':
        iconName = isFocused ? 'bed' : 'bed-outline';
        break;
      case 'Maintenance':
        iconName = isFocused ? 'hammer' : 'hammer-outline';
        break;
      default:
        iconName = 'grid-outline';
    }
    
    return iconName;
  };
  
  // Get color for tab
  const getTabColor = (index: number) => {
    const colors = [
      { active: '#4285F4', inactive: '#A5C8FF' }, // Blue - Home
      { active: '#E2AB2E', inactive: '#FFE8A5' }, // Yellow - Schedule
      { active: '#EB4D4B', inactive: '#FFA8A1' }, // Red - Add
      { active: '#EA4335', inactive: '#FFA8A1' }, // Red - Expenses
      { active: '#9C27B0', inactive: '#E1BEE7' }, // Purple - Furniture
      { active: '#34A853', inactive: '#A6E9BC' }, // Green - Maintenance
    ];
    
    return colors[index % colors.length];
  };

  // Render single tab item (all tabs are normal tabs now, no center tab)
  const renderTabItem = (route: any, index: number) => {
    const { options } = descriptors[route.key];
    const label = options.tabBarLabel || options.title || route.name;
    const isFocused = state.index === index;
    
    // Get tab animation value
    const tabAnimation = tabAnimations[index];
    const tabColor = getTabColor(index);
    const iconName = getTabIcon(route.name, isFocused);
    
    // Animation interpolations
    const scale = tabAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.1],
    });
    
    const translateY = tabAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -5],
    });
    
    const dotScale = tabAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });
    
    return (
      <TouchableOpacity
        key={route.key}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={() => handleTabPress(route, index)}
        style={styles.tab}
      >
        <Animated.View style={{ 
          transform: [{ scale }, { translateY }],
          alignItems: 'center',
          width: '100%'
        }}>
          {/* Active indicator dot */}
          <Animated.View 
            style={[
              styles.activeDot,
              { 
                backgroundColor: tabColor.active,
                transform: [{ scale: dotScale }]
              }
            ]}
          />
          
          <Ionicons
            name={iconName as any}
            size={24}
            color={isFocused ? tabColor.active : tabColor.inactive}
            style={styles.tabIcon}
          />
          
          <Text 
            style={[
              styles.tabLabel,
              { 
                color: isFocused ? tabColor.active : isDarkMode ? '#999' : '#777',
                fontWeight: isFocused ? '600' : '400' 
              }
            ]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {label.toString()}
          </Text>
          
          {/* Pressed effect */}
          {pressed === index && (
            <View style={styles.pressEffect} />
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Background highlight effect that follows the active tab
  const renderHighlight = () => {
    const highlightWidth = dimensions.width / state.routes.length;
    
    return (
      <Animated.View
        style={[
          styles.highlightContainer,
          {
            left: highlightPosition.interpolate({
              inputRange: [0, dimensions.width],
              outputRange: [-highlightWidth/2, dimensions.width - highlightWidth/2]
            }),
            transform: [{ scale: highlightScale }]
          }
        ]}
      >
        <BlurView
          intensity={isDarkMode ? 15 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.highlightBlur}
        />
      </Animated.View>
    );
  };
  
  return (
    <View 
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setDimensions({ width, height });
      }}
    >
      {/* Floating center button - moved higher up and rendered first for proper layering */}
      <View style={styles.centerButtonWrapper}>
        {renderCenterButton()}
      </View>
      
      {/* Base layer with curved design */}
      <Svg height="100%" width="100%" style={styles.curveSvg}>
        <Defs>
          <RadialGradient
            id="barGradient"
            cx="50%"
            cy="0%"
            rx="80%"
            ry="80%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={isDarkMode ? "#2D2D2D" : "#FFFFFF"} stopOpacity="1" />
            <Stop offset="100%" stopColor={isDarkMode ? "#151515" : "#F0F0F0"} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        
        <Path
          d={`
            M 0,25
            L 0,${dimensions.height}
            L ${dimensions.width},${dimensions.height}
            L ${dimensions.width},25
            Q ${dimensions.width / 2 + 60},0 ${dimensions.width / 2},0 
            Q ${dimensions.width / 2 - 60},0 0,25
            Z
          `}
          fill="url(#barGradient)"
        />
        
        {/* Subtle border for premium look */}
        <Path
          d={`
            M 0,25
            Q ${dimensions.width / 2 - 60},0 ${dimensions.width / 2},0 
            Q ${dimensions.width / 2 + 60},0 ${dimensions.width},25
          `}
          stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}
          strokeWidth="1"
          fill="none"
        />
      </Svg>
      
      {/* Glass blur effect */}
      <BlurView 
        intensity={isDarkMode ? 15 : 30}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.blurView}
      />
      
      {/* Moving highlight effect */}
      {renderHighlight()}
      
      {/* Main animated container for the tabs */}
      <Animated.View 
        style={[
          styles.tabsContainer,
          { height: barHeight }
        ]}
      >
        {state.routes.map(renderTabItem)}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 24,
    left: 20,
    right: 20,
    height: 85,
    zIndex: 1000,
    overflow: 'visible',
  },
  curveSvg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  blurView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    opacity: 0.9,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    height: 60,
    marginHorizontal: 5, // Add horizontal margin for spacing
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 5,
  },
  pressEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  highlightContainer: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    top: 5,
    marginLeft: -35,
    zIndex: -1,
  },
  highlightBlur: {
    flex: 1,
    borderRadius: 35,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  centerButtonWrapper: {
    position: 'absolute',
    top: -42, // Changed from -28 to -35 to move it higher
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1002, // Higher than tabs
  },
  centerButtonContainer: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 12,
  },
  centerButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 29,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
    width: '100%',
  },
});

export default PremiumTabBar;