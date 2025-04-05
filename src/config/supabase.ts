import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sdltppeeuuvcysgjdvof.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbHRwcGVldXV2Y3lzZ2pkdm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2NDY0MTksImV4cCI6MjA1OTIyMjQxOX0.Dwe7evzSkUYWBa1r84H8O1FGafDbPK4rKVpqfJoaIj4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
  // No need to configure realtime here, we'll use channels directly
});

// This function can be called to set up realtime subscriptions
export const initializeRealtimeChannels = () => {
  const tables = [
    'house_rules',
    'rule_agreements',
    'rule_comments',
    'notifications',
  ];
  
  return tables.map(table => {
    return supabase.channel(`table-${table}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table 
      }, (payload) => console.log(`Change in ${table}:`, payload))
      .subscribe();
  });
};
