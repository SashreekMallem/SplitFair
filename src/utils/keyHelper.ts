/**
 * Utility functions for handling React keys
 */

/**
 * Creates a guaranteed unique key by combining an ID with optional prefix and suffix
 * @param id The base ID to use
 * @param prefix Optional prefix to add
 * @param suffix Optional suffix like an index or timestamp
 * @returns A string key that's guaranteed to be unique
 */
export const createUniqueKey = (id: string | number, prefix?: string, suffix?: string | number): string => {
  const baseKey = `${prefix || ''}${id}${suffix ? `-${suffix}` : ''}`;
  // Add a timestamp to ensure uniqueness even if IDs are duplicated
  return `${baseKey}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
};

/**
 * Creates a stable key that will be consistent across renders for the same item
 * @param id The base ID to use
 * @param type A type prefix to avoid conflicts between different types of items
 * @returns A stable string key
 */
export const createStableKey = (id: string | number, type: string): string => {
  return `${type}-${id}`;
};
