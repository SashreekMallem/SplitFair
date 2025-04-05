import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import RootNavigator from './src/navigation/RootNavigator';
import 'react-native-url-polyfill/auto';

// Initialize Supabase realtime client
import { supabase } from './src/config/supabase';

// Configure Supabase realtime using the modern channel API
const initializeRealtime = () => {
  const tables = [
    'house_rules',
    'rule_agreements', 
    'rule_comments',
    'notifications'
  ];
  
  console.log('Setting up realtime channels for tables:', tables);
  
  // Create a channel for each table
  tables.forEach(table => {
    const channel = supabase.channel(`table-${table}`);
    
    // Listen for all changes on this table
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table }, 
        payload => {
          console.log(`Realtime change on ${table}:`, payload);
        }
      )
      .subscribe(status => {
        console.log(`Channel ${table} status:`, status);
      });
  });
};

// Initialize realtime channels
initializeRealtime();

// NavigationContainer theme using our app theme
const NavigationTheme = () => {
  const { theme } = useTheme();
  
  return (
    <NavigationContainer
      theme={{
        dark: theme.dark,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.primary,
        },
      }}
    >
      <RootNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            {/* Use NavigationTheme to get access to theme */}
            <NavigationTheme />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
