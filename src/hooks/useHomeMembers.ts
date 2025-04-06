import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchHomeMembers, fetchUserHomeMembership, HomeMember } from '../services/api/homeService';
import { logError } from '../utils/DebugHelper';

export const useHomeMembers = (homeId?: string) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedHomeId, setResolvedHomeId] = useState<string | null>(null);

  // Try to resolve the homeId if not provided
  const resolveHomeId = useCallback(async () => {
    if (homeId) {
      setResolvedHomeId(homeId);
      return homeId;
    }
    
    try {
      console.log('🏠 No homeId provided, attempting to fetch from user membership');
      if (!user?.id) {
        console.log('⚠️ Cannot fetch home: No authenticated user');
        return null;
      }
      
      // Try to get from user metadata first (fastest)
      if (user.user_metadata?.home_id) {
        const metadataHomeId = user.user_metadata.home_id;
        console.log('🏠 Found homeId in user metadata:', metadataHomeId);
        setResolvedHomeId(metadataHomeId);
        return metadataHomeId;
      }
      
      // If not in metadata, try to fetch from memberships
      console.log('🏠 Fetching user home membership from API');
      const membership = await fetchUserHomeMembership(user.id);
      if (membership && membership.home_id) {
        console.log('🏠 Found homeId from membership API:', membership.home_id);
        setResolvedHomeId(membership.home_id);
        return membership.home_id;
      }
      
      console.log('⚠️ Could not resolve homeId from any source');
      return null;
    } catch (err) {
      console.error('❌ Error resolving homeId:', err);
      return null;
    }
  }, [homeId, user]);

  const fetchMembers = useCallback(async () => {
    if (!user) {
      console.log('⚠️ Cannot fetch members: No authenticated user');
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Try to resolve the homeId if needed
      const effectiveHomeId = await resolveHomeId();
      if (!effectiveHomeId) {
        console.log('⚠️ Cannot fetch members: No home ID available');
        setMembers([]);
        setLoading(false);
        return;
      }
      
      console.log('🔍 Fetching members for homeId:', effectiveHomeId);
      const data = await fetchHomeMembers(effectiveHomeId, user.id);
      console.log(`🏠 Found ${data.length} home members`);
      
      // Add the current user to the list if not already there
      const currentUserExists = data.some(member => member.user_id === user.id);
      let allMembers = [...data];
      
      if (!currentUserExists) {
        console.log('👤 Adding current user to members list');
        const youMember: HomeMember = {
          id: 'current-user',
          user_id: user.id,
          home_id: effectiveHomeId,
          role: 'member',
          rent_contribution: 0,
          move_in_date: new Date().toISOString().split('T')[0],
          joined_at: new Date().toISOString(),
          full_name: 'You',
          email: user.email || '',
        };
        
        allMembers = [youMember, ...data];
      }
      
      console.log(`🏠 Final members list contains ${allMembers.length} members`);
      setMembers(allMembers);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch home members';
      setError(errorMessage);
      logError(`Error in useHomeMembers.fetchMembers: ${errorMessage}`);
      console.error('❌ Error fetching home members:', err);
    } finally {
      setLoading(false);
    }
  }, [user, resolveHomeId]);

  useEffect(() => {
    console.log('🔄 useHomeMembers effect triggered - fetching members');
    fetchMembers();
  }, [fetchMembers]);

  const formatMemberName = useCallback((memberId: string): string => {
    if (!user) return 'Unknown';
    
    // Check if this is the current user
    if (memberId === user.id) return 'You';
    
    // Find the member in our list
    const member = members.find(m => m.user_id === memberId);
    return member?.full_name || 'Unknown';
  }, [members, user]);

  return {
    members,
    loading,
    error,
    refreshMembers: fetchMembers,
    formatMemberName,
    resolvedHomeId
  };
};

export default useHomeMembers;
