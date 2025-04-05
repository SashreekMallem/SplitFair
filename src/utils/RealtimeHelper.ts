import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

/**
 * A helper to manage realtime subscriptions
 */
export class RealtimeSubscription {
  private channel: RealtimeChannel | null = null;
  private channelName: string;
  
  constructor(channelName: string) {
    this.channelName = channelName;
  }
  
  /**
   * Subscribe to a specific table with optional filter
   */
  subscribe<T>(
    tableName: string, 
    eventTypes: ('INSERT' | 'UPDATE' | 'DELETE')[] = ['INSERT', 'UPDATE', 'DELETE'],
    filter?: string,
    callback?: (payload: { 
      eventType: 'INSERT' | 'UPDATE' | 'DELETE', 
      new?: T, 
      old?: T 
    }) => void
  ): void {
    // Unsubscribe from any existing channel first
    this.unsubscribe();
    
    // Create event string from array 
    const eventString = eventTypes.length === 3 
      ? '*' 
      : eventTypes.join(',').toLowerCase();
    
    // Set up the channel
    this.channel = supabase
      .channel(this.channelName)
      .on(
        'postgres_changes',
        {
          event: eventString,
          schema: 'public',
          table: tableName,
          ...(filter ? { filter } : {}) 
        },
        (payload) => {
          console.log(`Real-time update [${tableName}]:`, payload);
          if (callback) {
            callback({
              eventType: payload.eventType as any,
              new: payload.new as T,
              old: payload.old as T
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`Subscription status for ${this.channelName}:`, status);
      });
  }
  
  /**
   * Unsubscribe from the current channel
   */
  unsubscribe(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
  
  /**
   * Get channel status
   */
  getStatus(): string {
    return this.channel ? 'subscribed' : 'unsubscribed';
  }
}

/**
 * Enable realtime for specific tables in Supabase
 */
export const enableRealtimeForTables = async (
  tables: string[]
): Promise<boolean> => {
  try {
    // This requires SUPABASE_KEY with proper permissions
    const { error } = await supabase.rpc('supabase_realtime', { 
      table_ids: tables
    });
    
    if (error) {
      console.error('Failed to enable realtime:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error enabling realtime:', err);
    return false;
  }
};
