import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import * as eventService from '../services/api/eventService';
import { fetchUserHomeMembership } from '../services/api/homeService';
import { 
  Event, 
  AttendanceStatus,
  CreateEventParams
} from '../services/api/eventService';
import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const useEvents = (initialHomeId?: string) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [homeId, setHomeId] = useState<string | undefined>(initialHomeId);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // References to realtime subscriptions
  const eventsSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const attendeesSubscriptionRef = useRef<RealtimeChannel | null>(null);
  
  // Update homeId if initialHomeId changes
  useEffect(() => {
    setHomeId(initialHomeId);
  }, [initialHomeId]);

  // Fetch user's default home if homeId is not provided
  const fetchUserDefaultHome = useCallback(async () => {
    if (!user?.id) {
      return null;
    }
    
    try {
      const membership = await fetchUserHomeMembership(user.id);
      if (membership && membership.home_id) {
        setHomeId(membership.home_id);
        return membership.home_id;
      }
      return null;
    } catch (err) {
      return null;
    }
  }, [user]);
  
  // Fetch all events for a home within a date range
  const fetchEvents = useCallback(async (
    targetHomeId?: string,
    startDate: string = new Date().toISOString().split('T')[0],
    endDate?: string
  ) => {
    const homeIdToUse = targetHomeId || homeId;
    
    if (!homeIdToUse) {
      const defaultHomeId = await fetchUserDefaultHome();
      
      if (!defaultHomeId) {
        setEvents([]);
        setLoading(false);
        return null;
      }
    }
    
    const effectiveHomeId = targetHomeId || homeId || await fetchUserDefaultHome();
    
    if (!effectiveHomeId) {
      setEvents([]);
      setLoading(false);
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const eventsData = await eventService.fetchEvents(
        effectiveHomeId,
        startDate,
        endDate
      );
      
      setEvents(eventsData);
      return eventsData;
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
      return null;
    } finally {
      setLoading(false);
    }
  }, [homeId, fetchUserDefaultHome]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!homeId || !user?.id) {
      return;
    }

    // Clean up any existing subscriptions
    if (eventsSubscriptionRef.current) {
      eventsSubscriptionRef.current.unsubscribe();
      eventsSubscriptionRef.current = null;
    }
    
    if (attendeesSubscriptionRef.current) {
      attendeesSubscriptionRef.current.unsubscribe();
      attendeesSubscriptionRef.current = null;
    }
    
    // Create subscription for events table
    const eventsSubscription = supabase
      .channel(`events-${Platform.OS}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `home_id=eq.${homeId}`
        },
        async (payload) => {
          console.log('Real-time events update:', payload);
          
          // Refresh events on change - this is a simpler approach than trying
          // to update the state in-place, which can get complex with nested data
          fetchEvents();
        }
      )
      .subscribe();
    
    // Create subscription for event_attendees table
    const attendeesSubscription = supabase
      .channel(`event-attendees-${Platform.OS}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_attendees'
        },
        async (payload) => {
          console.log('Real-time event attendees update:', payload);
          
          // If it involves the current user or an event they care about,
          // refresh the events list
          if (
            (payload.new && payload.new.user_id === user.id) ||
            (payload.old && payload.old.user_id === user.id)
          ) {
            fetchEvents();
          } else {
            // For other users' changes, find the event in the current state
            // and update only that event
            const eventId = payload.new?.event_id || payload.old?.event_id;
            if (eventId) {
              const event = events.find(e => e.id === eventId);
              if (event) {
                const updatedEvent = await eventService.fetchEvents(homeId, event.event_date, event.event_date);
                if (updatedEvent && updatedEvent.length > 0) {
                  setEvents(prev => prev.map(e => e.id === eventId ? updatedEvent[0] : e));
                }
              }
            }
          }
        }
      )
      .subscribe();
    
    // Store subscription references
    eventsSubscriptionRef.current = eventsSubscription;
    attendeesSubscriptionRef.current = attendeesSubscription;
    
    // Clean up on unmount or when homeId/user changes
    return () => {
      if (eventsSubscriptionRef.current) {
        eventsSubscriptionRef.current.unsubscribe();
        eventsSubscriptionRef.current = null;
      }
      
      if (attendeesSubscriptionRef.current) {
        attendeesSubscriptionRef.current.unsubscribe();
        attendeesSubscriptionRef.current = null;
      }
    };
  }, [homeId, user, fetchEvents, events]);
  
  // Create a new event
  const createEvent = useCallback(async (eventData: CreateEventParams) => {
    if (!user) {
      return null;
    }
    
    let targetHomeId = homeId;
    
    if (!targetHomeId) {
      targetHomeId = await fetchUserDefaultHome();
    }
    
    if (!targetHomeId) {
      return null;
    }
    
    try {
      const newEvent = await eventService.createEvent(
        targetHomeId,
        user.id,
        eventData
      );
      
      if (newEvent) {
        // Refresh the events list to ensure we have the latest data
        fetchEvents();
        showNotification('Success', 'Event created successfully', 'success');
      }
      
      return newEvent;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to create event', 'error');
      return null;
    }
  }, [user, homeId, fetchUserDefaultHome, fetchEvents, showNotification]);
  
  // Update an event
  const updateEvent = useCallback(async (
    eventId: string,
    updates: Partial<Event>,
    updateAttendees?: string[]
  ) => {
    try {
      const updatedEvent = await eventService.updateEvent(
        eventId,
        updates,
        updateAttendees
      );
      
      if (updatedEvent) {
        // Refresh the events list to ensure we have the latest data
        fetchEvents();
        showNotification('Success', 'Event updated successfully', 'success');
      }
      
      return updatedEvent;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to update event', 'error');
      return null;
    }
  }, [fetchEvents, showNotification]);
  
  // Delete an event
  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      const success = await eventService.deleteEvent(eventId);
      
      if (success) {
        // Remove the event from the local state
        setEvents(prev => prev.filter(event => event.id !== eventId));
        showNotification('Success', 'Event deleted', 'success');
      }
      
      return success;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to delete event', 'error');
      return false;
    }
  }, [showNotification]);
  
  // Update attendance status for an event
  const updateAttendanceStatus = useCallback(async (
    eventId: string,
    status: AttendanceStatus
  ) => {
    if (!user) {
      return false;
    }
    
    try {
      const success = await eventService.updateAttendanceStatus(
        eventId,
        user.id,
        status
      );
      
      if (success) {
        // Update the attendance status in the local state
        setEvents(prev => prev.map(event => {
          if (event.id === eventId) {
            const updatedAttendees = event.attendees?.map(attendee => {
              if (attendee.user_id === user.id) {
                return { ...attendee, status };
              }
              return attendee;
            }) || [];
            
            // If user wasn't already an attendee, add them
            const isUserAttendee = updatedAttendees.some(a => a.user_id === user.id);
            if (!isUserAttendee) {
              updatedAttendees.push({
                id: `temp-${Date.now()}`,
                event_id: eventId,
                user_id: user.id,
                user_name: 'You',
                status,
                created_at: new Date().toISOString()
              });
            }
            
            return { ...event, attendees: updatedAttendees };
          }
          return event;
        }));
        
        showNotification('Success', 'Attendance status updated', 'success');
      }
      
      return success;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to update attendance', 'error');
      return false;
    }
  }, [user, showNotification]);
  
  // Load events on mount and when homeId changes
  useEffect(() => {
    if (homeId) {
      fetchEvents();
    } else {
      fetchUserDefaultHome().then(defaultHomeId => {
        if (defaultHomeId) {
          fetchEvents(defaultHomeId);
        } else {
          setEvents([]);
        }
      });
    }
  }, [homeId, fetchEvents, fetchUserDefaultHome]);
  
  return {
    events,
    loading,
    error,
    homeId,
    setHomeId,
    fetchEvents,
    refreshEvents: fetchEvents, // Alias for consistency
    createEvent,
    updateEvent,
    deleteEvent,
    updateAttendanceStatus,
  };
};

export default useEvents;
