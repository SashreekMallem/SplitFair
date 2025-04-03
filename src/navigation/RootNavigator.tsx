import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ProfileScreen from '../screens/main/ProfileScreen';

// Define the RootStackParamList to include ProfileScreen
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ProfileScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { authState } = useAuth();
  const { theme } = useTheme();

  // Add a loading state check
  if (authState === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#546DE5" />
      </View>
    );
  }

  return (
    // Remove the NavigationContainer wrapper - it should only be in App.tsx
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      {authState.isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen 
            name="ProfileScreen" 
            component={ProfileScreen} 
            options={{
              animation: 'slide_from_right'
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
