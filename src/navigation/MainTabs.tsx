import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from '../screens/main/HomeScreen';

// Placeholder component for screens that aren't implemented yet
const ScreenPlaceholder: React.FC<{title: string}> = ({ title }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.placeholderContainer, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.placeholderText, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.placeholderSubtext, { color: theme.colors.text }]}>
        Screen implementation will be added later
      </Text>
    </View>
  );
};

const Tab = createBottomTabNavigator();

const MainTabs: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerShown: false, // Hide header for all tabs
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: 'rgba(0,0,0,0.05)',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = '';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Items') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Expenses') {
            iconName = focused ? 'card' : 'card-outline';
          } else if (route.name === 'Sanitization') {
            iconName = focused ? 'water' : 'water-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
      />
      <Tab.Screen 
        name="Expenses" 
        component={() => <ScreenPlaceholder title="Expenses Screen" />} 
      />
      <Tab.Screen 
        name="Items" 
        component={() => <ScreenPlaceholder title="Items List Screen" />} 
      />
      <Tab.Screen 
        name="Sanitization" 
        component={() => <ScreenPlaceholder title="Sanitization Screen" />} 
      />
      <Tab.Screen 
        name="Profile" 
        component={() => <ScreenPlaceholder title="Profile Screen" />} 
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default MainTabs;
