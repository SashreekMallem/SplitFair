import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchHomeMembers, HomeMember } from '../services/api/homeService';
import { logError } from '../utils/DebugHelper';

export const useHomeMembers = (homeId?: string) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!homeId || !user) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchHomeMembers(homeId, user.id);
      
      // Add the current user to the list if not already there
      // Since this function typically returns other roommates, we'll create a representation for "You"
      const currentUserExists = data.some(member => member.user_id === user.id);
      let allMembers = [...data];
      
      if (!currentUserExists) {
        const youMember: HomeMember = {
          id: 'current-user',
          user_id: user.id,
          home_id: homeId,
          role: 'member', // Default role if we don't know
          rent_contribution: 0, // Default value
          move_in_date: new Date().toISOString().split('T')[0],
          joined_at: new Date().toISOString(),
          full_name: 'You',
          email: user.email || '',
        };
        
        allMembers = [youMember, ...data];
      }
      
      setMembers(allMembers);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch home members');
      logError(`Error in useHomeMembers.fetchMembers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [homeId, user]);

  useEffect(() => {
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
  };
};

export default useHomeMembers;
