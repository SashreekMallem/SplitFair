/**
 * Date helper utility functions for the application
 * Provides common date operations without external dependencies
 */

/**
 * Format a date to localized string representation
 * @param date The date to format
 * @param options Formatting options
 */
export const formatToLocalDateString = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISODate(date) : date;
    return dateObj.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date to local string:', error);
    return typeof date === 'string' ? date : date.toString();
  }
};

/**
 * Format a date string for display to users
 * @param dateStr ISO format date string (YYYY-MM-DD)
 * @param includeYear Whether to include the year
 */
export const formatDateForDisplay = (
  dateStr: string, 
  includeYear: boolean = true
): string => {
  try {
    if (!dateStr) return '';
    const date = parseISODate(dateStr);
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric'
    };
    
    if (includeYear) {
      options.year = 'numeric';
    }
    
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date for display:', error);
    return dateStr;
  }
};

/**
 * Parse a date string in various formats to a Date object
 * @param dateStr Date string to parse
 */
export const parseDateString = (dateStr: string): Date | null => {
  try {
    if (!dateStr) return null;
    
    // Try ISO format first (YYYY-MM-DD)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return parseISODate(dateStr);
    }
    
    // Try other common formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch (error) {
    console.error('Error parsing date string:', error);
    return null;
  }
};

/**
 * Get today's date as an ISO string (YYYY-MM-DD)
 */
export const getTodayString = (): string => {
  const today = new Date();
  return formatDateToYYYYMMDD(today);
};

/**
 * Get tomorrow's date as an ISO string (YYYY-MM-DD)
 */
export const getTomorrowString = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateToYYYYMMDD(tomorrow);
};

/**
 * Format a date string to a more readable format
 * @param dateStr ISO format date string (YYYY-MM-DD)
 * @param formatStyle The format style to use (defaults to 'medium')
 */
export const formatDateString = (
  dateStr: string, 
  formatStyle: 'short' | 'medium' | 'long' = 'medium'
): string => {
  try {
    if (!dateStr) return '';
    const date = parseISODate(dateStr);
    
    const options: Intl.DateTimeFormatOptions = { 
      month: formatStyle === 'short' ? 'short' : 'short',
      day: 'numeric',
      year: 'numeric'
    };
    
    if (formatStyle === 'long') {
      options.weekday = 'long';
    }
    
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr;
  }
};

/**
 * Get the day of week from a date string
 * @param dateStr ISO format date string (YYYY-MM-DD)
 * @returns A string representing the day of week (mon, tue, etc.)
 */
export const getDayOfWeek = (dateStr: string): string => {
  try {
    const date = parseISODate(dateStr);
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[date.getDay()];
  } catch (error) {
    console.error('Error getting day of week:', error);
    return '';
  }
};

/**
 * Get the time slot for a given hour
 * @param hour Hour in 24-hour format (0-23)
 * @returns The corresponding time slot (morning, afternoon, evening, night)
 */
export const getTimeSlotForHour = (hour: number): string => {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

/**
 * Check if a date is in the past
 * @param dateStr ISO format date string (YYYY-MM-DD)
 */
export const isPastDate = (dateStr: string): boolean => {
  try {
    const date = parseISODate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  } catch (error) {
    return false;
  }
};

/**
 * Check if a date is today
 * @param dateStr ISO format date string (YYYY-MM-DD)
 */
export const isDateToday = (dateStr: string): boolean => {
  try {
    const date = parseISODate(dateStr);
    const today = new Date();
    
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  } catch (error) {
    return false;
  }
};

/**
 * Get a date string for X days from now
 * @param daysFromToday Number of days from today
 */
export const getDateStringDaysFromNow = (daysFromToday: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return formatDateToYYYYMMDD(date);
};

/**
 * Generate date string from a day of week
 * @param dayOfWeek The day of week (mon, tue, etc.)
 * @returns Date string for the next occurrence of this day
 */
export const getDateFromDayOfWeek = (dayOfWeek: string): string => {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayIndex = days.indexOf(dayOfWeek.toLowerCase());
  if (dayIndex === -1) return getTodayString();
  
  const today = new Date();
  const currentDayIndex = today.getDay();
  
  // Calculate days to add
  let daysToAdd = dayIndex - currentDayIndex;
  if (daysToAdd <= 0) daysToAdd += 7; // Go to next week if needed
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);
  return formatDateToYYYYMMDD(targetDate);
};

// Helper function to format date to YYYY-MM-DD
export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to parse ISO date strings (YYYY-MM-DD)
export const parseISODate = (dateStr: string): Date => {
  // Split the date string to get year, month, and day
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create a new date (month is 0-indexed in JavaScript)
  return new Date(year, month - 1, day);
};

/**
 * Format a date object to a time string (HH:MM AM/PM)
 */
export const formatTimeString = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Get the current date and time as an ISO string
 */
export const getCurrentDateTimeString = (): string => {
  return new Date().toISOString();
};

/**
 * Add days to a date and return the new date
 */
export const addDaysToDate = (dateStr: string, days: number): string => {
  try {
    const date = parseISODate(dateStr);
    date.setDate(date.getDate() + days);
    return formatDateToYYYYMMDD(date);
  } catch (error) {
    console.error('Error adding days to date:', error);
    return dateStr;
  }
};
