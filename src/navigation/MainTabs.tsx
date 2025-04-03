import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from '../screens/main/HomeScreen';
import PremiumTabBar from '../components/PremiumTabBar';
import HomeIsland, { IslandMode } from '../components/HomeIsland';
import { useNotification } from '../context/NotificationContext';
import ProfileScreen from '../screens/main/ProfileScreen';

// Mock data for testing - This would typically come from your data service
const mockExpenses = [
  { id: 1, title: 'Internet Bill', amount: 89.99, date: '2023-11-15', paidBy: 'Alex', category: 'utilities' },
  { id: 2, title: 'Grocery Shopping', amount: 124.56, date: '2023-11-12', paidBy: 'You', category: 'groceries' },
  { id: 3, title: 'Water Bill', amount: 45.00, date: '2023-11-10', paidBy: 'Jordan', category: 'utilities' },
];

const mockSanitizationTasks = [
  { id: 1, title: 'Kitchen Cleaning', assignedTo: 'You', dueDate: '2023-11-18', status: 'pending' },
  { id: 2, title: 'Bathroom Cleaning', assignedTo: 'Alex', dueDate: '2023-11-17', status: 'completed' },
  { id: 3, title: 'Living Room', assignedTo: 'Jordan', dueDate: '2023-11-20', status: 'pending' },
];

const mockScheduledTasks = [
  { id: 1, title: 'Plumber Visit', date: '2023-11-19', time: '10:00 AM', createdBy: 'Alex' },
  { id: 2, title: 'Rent Payment', date: '2023-11-30', time: 'All day', createdBy: 'System' },
  { id: 3, title: 'House Meeting', date: '2023-11-22', time: '7:00 PM', createdBy: 'You' },
];

const mockFurniture = [
  { id: 1, title: 'Living Room Couch', owner: 'Alex', sharedWith: ['You', 'Jordan'], value: 899 },
  { id: 2, title: 'Dining Table', owner: 'Jordan', sharedWith: ['You', 'Alex'], value: 650 },
  { id: 3, title: 'Coffee Machine', owner: 'You', sharedWith: ['All'], value: 199 },
];

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
  const { showNotification } = useNotification();
  
  // Island state management - moved from HomeScreen to be universal
  const [islandMode, setIslandMode] = useState<IslandMode>('summary');

  // Function to handle island action button presses
  const handleIslandAction = () => {
    switch (islandMode) {
      case 'summary':
        showNotification('Home Summary', 'Viewing detailed home overview', 'info');
        break;
      case 'expenses':
        showNotification('Payment', 'Processing payment...', 'success');
        break;
      case 'tasks':
        showNotification('Task', 'Task marked as completed', 'success');
        break;
      case 'schedule':
        showNotification('Reminder', 'Rent reminder set for 3 days before due date', 'info');
        break;
      case 'alert':
        showNotification('Payment', 'Resolving overdue payment...', 'warning');
        break;
      case 'furniture':
        showNotification('Furniture', 'Adding new shared item...', 'info');
        break;
    }
  };

  return (
    <>
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
          tabBarStyle: { 
            position: 'absolute', 
            bottom: 0,
            height: 0,
            opacity: 0
          }
        }}
        sceneContainerStyle={{
          backgroundColor: theme.colors.background,
          paddingBottom: 110
        }}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
        />
        <Tab.Screen 
          name="Schedule" 
          component={() => <ScreenPlaceholder title="Schedule Screen" />} 
        />
        <Tab.Screen 
          name="Expenses" 
          component={() => <ScreenPlaceholder title="Expenses Screen" />} 
        />
        <Tab.Screen 
          name="Furniture" 
          component={() => <ScreenPlaceholder title="Furniture Screen" />} 
        />
        <Tab.Screen 
          name="Maintenance" 
          component={() => <ScreenPlaceholder title="Maintenance Screen" />} 
        />
        {/* Profile screen is removed from tabs, will be accessed via profile icon */}
      </Tab.Navigator>

      {/* Universal Dynamic Island that persists across all tabs */}
      <HomeIsland 
        mode={islandMode} 
        onModeChange={setIslandMode} 
        onActionPress={handleIslandAction}
        navigation={Tab} 
        data={{
          expenses: mockExpenses,
          tasks: mockSanitizationTasks,
          events: mockScheduledTasks,
          furniture: mockFurniture
        }}
      />
    </>
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
  }
});

export default MainTabs;
