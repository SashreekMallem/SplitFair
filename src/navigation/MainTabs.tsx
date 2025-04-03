import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from '../screens/main/HomeScreen';
import PremiumTabBar from '../components/PremiumTabBar';

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
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerShown: false,
        tabBarShowLabel: true,
      }}
      sceneContainerStyle={{
        backgroundColor: theme.colors.background,
        // Add bottom padding to avoid tab bar overlap
        paddingBottom: 100
      }}
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
