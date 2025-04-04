import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import ProfileScreen from '../screens/main/ProfileScreen';
import ExpensesScreen from '../screens/main/ExpensesScreen';

const Stack = createStackNavigator();

const RootNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return null;
  }

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background }
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
          <Stack.Screen name="ExpensesScreen" component={ExpensesScreen} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
