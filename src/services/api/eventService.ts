import { supabase } from '../../config/supabase';
import { createHomeNotification, createUserNotification } from './notificationService';

export type EventCategory = 'meeting' | 'payment' | 'social' | 'maintenance' | 'other';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type AttendanceStatus = 'going' | 'maybe' | 'not_going';

export interface Event {
  id: string;
  home_id: string;
  title: string;
  description?: string;
  event_date: string; // ISO format date
  start_time?: string; // HH:MM format
  end_time?: string; // HH:MM format
  is_all_day: boolean;
  location?: string;
  category?: EventCategory;
  created_by: string;
  recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  recurrence_end_date?: string; // ISO format date
  created_at: string;
  updated_at: string;
  is_active: boolean;
  
  // Joined fields (not in actual table)
  created_by_name?: string;
  attendees?: EventAttendee[];
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: AttendanceStatus;
  created_at: string;
  
  // Joined fields
  user_name?: string;
}

export interface CreateEventParams {
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  location?: string;
  category?: EventCategory;
  recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  recurrence_end_date?: string;
  attendees?: string[]; // Array of user IDs to invite
}

/**
 * Fetch events for a home within a date range
 */
export const fetchEvents = async (
  homeId: string,
  startDate: string,
  endDate?: string
): Promise<Event[]> => {
  try {
    let query = supabase
      .from('events')
      .select(`
        *,
        attendees:event_attendees(id, user_id, status)
      `)
      .eq('home_id', homeId)
      .eq('is_active', true)
      .gte('event_date', startDate)
      .order('event_date', { ascending: true });
      
    if (endDate) {
      query = query.lte('event_date', endDate);
    }
    
    const { data, error } = await query;
    
    if (error || !data) {
      console.error('Error fetching events:', error);
      return [];
    }
    
    // Process the events to add additional information
    const enhancedEvents = await enhanceEventsWithNames(data);
    
    return enhancedEvents;
  } catch (error) {
    console.error('Unexpected error in fetchEvents:', error);
    return [];
  }
};

/**
 * Enhance events with user names for creator and attendees
 */
const enhanceEventsWithNames = async (events: Event[]): Promise<Event[]> => {
  if (!events || events.length === 0) return [];
  
  // Collect all user IDs that need names
  const userIds = new Set<string>();
  
  events.forEach(event => {
    if (event.created_by) userIds.add(event.created_by);
    
    // Add user IDs from attendees
    if (event.attendees) {
      event.attendees.forEach(attendee => {
        if (attendee.user_id) userIds.add(attendee.user_id);
      });
    }
  });
  
  // Fetch user profiles for all collected IDs
  if (userIds.size === 0) return events;
  
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', Array.from(userIds));
    
  if (!profiles) return events;
  
  // Create a map for easy lookups
  const nameMap = profiles.reduce((acc, profile) => {
    acc[profile.user_id] = profile.full_name;
    return acc;
  }, {} as Record<string, string>);
  
  // Get current user ID for "You" replacement
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  
  // Enhance events with names
  return events.map(event => {
    const enhancedEvent = { ...event };
    
    // Add created_by name
    if (event.created_by) {
      enhancedEvent.created_by_name = event.created_by === currentUserId ? 
        'You' : (nameMap[event.created_by] || 'System');
    }
    
    // Add names to attendees
    if (event.attendees) {
      enhancedEvent.attendees = event.attendees.map(attendee => ({
        ...attendee,
        user_name: attendee.user_id === currentUserId ? 
          'You' : (nameMap[attendee.user_id] || 'Unknown')
      }));
    }
    
    return enhancedEvent;
  });
};

/**
 * Create a new event
 */
export const createEvent = async (
  homeId: string,
  userId: string,
  eventData: CreateEventParams
): Promise<Event | null> => {
  try {
    // Create the event
    const newEvent = {
      home_id: homeId,
      created_by: userId,
      title: eventData.title,
      description: eventData.description || '',
      event_date: eventData.event_date,
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      is_all_day: eventData.is_all_day || false,
      location: eventData.location,
      category: eventData.category || 'other',
      recurring: eventData.recurring || false,
      recurrence_pattern: eventData.recurrence_pattern,
      recurrence_end_date: eventData.recurrence_end_date
    };
    
    const { data: event, error } = await supabase
      .from('events')
      .insert(newEvent)
      .select()
      .single();
    
    if (error || !event) {
      console.error('Error creating event:', error);
      return null;
    }
    
    // Add attendees if provided
    const attendees = eventData.attendees || [];
    if (attendees.length > 0) {
      const attendeesData = attendees.map(attendeeId => ({
        event_id: event.id,
        user_id: attendeeId,
        status: 'going' as AttendanceStatus
      }));
      
      const { error: attendeesError } = await supabase
        .from('event_attendees')
        .insert(attendeesData);
      
      if (attendeesError) {
        console.error('Error adding attendees:', attendeesError);
      }
    }
    
    // Always add the creator as an attendee if not already included
    if (!attendees.includes(userId)) {
      await supabase
        .from('event_attendees')
        .insert({
          event_id: event.id,
          user_id: userId,
          status: 'going'
        });
    }
    
    // Get user's name for notification
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();
      
    const userName = userProfile?.full_name || 'A user';
    
    // Notify all home members about the new event
    await createHomeNotification(
      homeId,
      'New Event Added',
      `${userName} added an event: ${eventData.title} on ${formatDate(eventData.event_date)}`,
      'info',
      'events',
      event.id
    );
    
    // Notify attendees individually
    if (attendees.length > 0) {
      for (const attendeeId of attendees) {
        if (attendeeId !== userId) {
          await createUserNotification(
            attendeeId,
            homeId,
            'Event Invitation',
            `${userName} invited you to: ${eventData.title} on ${formatDate(eventData.event_date)}`,
            'info',
            'events',
            event.id
          );
        }
      }
    }
    
    // Return the created event with enhanced info
    const enhancedEvents = await enhanceEventsWithNames([event]);
    return enhancedEvents[0] || event;
    
  } catch (error) {
    console.error('Unexpected error in createEvent:', error);
    return null;
  }
};

/**
 * Update an event
 */
export const updateEvent = async (
  eventId: string,
  updates: Partial<Event>,
  updateAttendees?: string[] // New list of attendee IDs
): Promise<Event | null> => {
  try {
    // Update the event
    const { data: event, error } = await supabase
      .from('events')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();
    
    if (error || !event) {
      console.error('Error updating event:', error);
      return null;
    }
    
    // Update attendees if provided
    if (updateAttendees) {
      // Get current attendees
      const { data: currentAttendees } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', eventId);
      
      const currentAttendeeIds = currentAttendees?.map(a => a.user_id) || [];
      
      // Find attendees to add and remove
      const attendeesToAdd = updateAttendees.filter(id => !currentAttendeeIds.includes(id));
      const attendeesToRemove = currentAttendeeIds.filter(id => !updateAttendees.includes(id));
      
      // Add new attendees
      if (attendeesToAdd.length > 0) {
        const newAttendees = attendeesToAdd.map(userId => ({
          event_id: eventId,
          user_id: userId,
          status: 'going' as AttendanceStatus
        }));
        
        await supabase
          .from('event_attendees')
          .insert(newAttendees);
      }
      
      // Remove old attendees
      if (attendeesToRemove.length > 0) {
        await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', eventId)
          .in('user_id', attendeesToRemove);
      }
    }
    
    // Return the updated event with enhanced info
    const enhancedEvents = await enhanceEventsWithNames([event]);
    return enhancedEvents[0] || event;
    
  } catch (error) {
    console.error('Unexpected error in updateEvent:', error);
    return null;
  }
};

/**
 * Delete an event (soft delete)
 */
export const deleteEvent = async (eventId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('events')
      .update({ is_active: false })
      .eq('id', eventId);
    
    return !error;
  } catch (error) {
    console.error('Unexpected error in deleteEvent:', error);
    return false;
  }
};

/**
 * Update attendance status for an event
 */
export const updateAttendanceStatus = async (
  eventId: string,
  userId: string,
  status: AttendanceStatus
): Promise<boolean> => {
  try {
    // Check if already an attendee
    const { data: existing } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (existing) {
      // Update existing status
      const { error } = await supabase
        .from('event_attendees')
        .update({ status })
        .eq('id', existing.id);
      
      return !error;
    } else {
      // Add new attendee
      const { error } = await supabase
        .from('event_attendees')
        .insert({
          event_id: eventId,
          user_id: userId,
          status
        });
      
      return !error;
    }
  } catch (error) {
    console.error('Unexpected error in updateAttendanceStatus:', error);
    return false;
  }
};

// Helper function to format dates for display
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch (error) {
    return dateString;
  }
};
