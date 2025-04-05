import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import * as houseRulesService from '../services/api/houseRulesService';
import { fetchUserHomeMembership } from '../services/api/homeService';
import { HouseRule } from '../services/api/houseRulesService';

export const useHouseRules = (initialHomeId?: string) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [homeId, setHomeId] = useState<string | undefined>(initialHomeId);
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
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
  
  // Fetch all rules for a home
  const fetchRules = useCallback(async (targetHomeId?: string) => {
    // Use provided targetHomeId, or fall back to state homeId
    const homeIdToUse = targetHomeId || homeId;
    
    if (!homeIdToUse) {
      const defaultHomeId = await fetchUserDefaultHome();
      
      if (!defaultHomeId) {
        setRules([]);
        setLoading(false);
        return null;
      }
    }
    
    // At this point we should have a valid homeId either from props, params, or user default
    const effectiveHomeId = targetHomeId || homeId || await fetchUserDefaultHome();
    
    if (!effectiveHomeId) {
      setRules([]);
      setLoading(false);
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const rulesData = await houseRulesService.fetchHouseRules(effectiveHomeId);
      setRules(rulesData);
      return rulesData;
    } catch (err: any) {
      setError(err.message || 'Failed to load house rules');
      return null;
    } finally {
      setLoading(false);
    }
  }, [homeId, fetchUserDefaultHome]);
  
  // Create a new rule
  const createRule = useCallback(async (
    ruleData: {
      title: string;
      description: string;
      category: string;
    },
    overrideHomeId?: string
  ) => {
    if (!user) {
      return null;
    }
    
    // Use overrideHomeId, or homeId from state, or try to fetch user's default home
    let targetHomeId = overrideHomeId || homeId;
    
    if (!targetHomeId) {
      targetHomeId = await fetchUserDefaultHome();
    }
    
    if (!targetHomeId) {
      return null;
    }
    
    try {
      const newRule = await houseRulesService.createHouseRule(
        targetHomeId,
        user.id,
        ruleData
      );
      
      if (newRule) {
        // Add the new rule to state with initial data
        const enhancedRule = {
          ...newRule,
          creator_name: user.user_metadata?.full_name || 'You',
          agreements: [{
            id: 'temp-id',
            rule_id: newRule.id,
            user_id: user.id,
            user_name: 'You',
            agreed_at: new Date().toISOString()
          }],
          comments: []
        };
        
        setRules(prev => [enhancedRule, ...prev]);
        showNotification('Success', 'House rule created successfully', 'success');
      }
      
      return newRule;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to create house rule', 'error');
      return null;
    }
  }, [user, homeId, showNotification, fetchUserDefaultHome]);
  
  // Toggle agreement for a rule
  const toggleAgreement = useCallback(async (ruleId: string) => {
    if (!user) return false;
    
    try {
      const success = await houseRulesService.toggleRuleAgreement(ruleId, user.id);
      
      if (success) {
        setRules(prev => prev.map(rule => {
          if (rule.id === ruleId) {
            // Check if user has already agreed
            const userAgreement = rule.agreements?.find(a => a.user_id === user.id);
            
            if (userAgreement) {
              // Remove agreement
              return {
                ...rule,
                agreements: rule.agreements?.filter(a => a.user_id !== user.id) || []
              };
            } else {
              // Add agreement
              return {
                ...rule,
                agreements: [
                  ...(rule.agreements || []),
                  {
                    id: `temp-${Date.now()}`,
                    rule_id: ruleId,
                    user_id: user.id,
                    user_name: user.user_metadata?.full_name || 'You',
                    agreed_at: new Date().toISOString()
                  }
                ]
              };
            }
          }
          return rule;
        }));
      }
      
      return success;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to update agreement', 'error');
      return false;
    }
  }, [user, showNotification]);
  
  // Add a comment to a rule
  const addComment = useCallback(async (ruleId: string, commentText: string) => {
    if (!user) {
      return null;
    }
    
    try {
      const comment = await houseRulesService.addRuleComment(
        ruleId,
        user.id,
        commentText
      );
      
      if (comment) {
        setRules(prev => prev.map(rule => {
          if (rule.id === ruleId) {
            return {
              ...rule,
              comments: [
                ...(rule.comments || []),
                {
                  ...comment,
                  user_name: user.user_metadata?.full_name || 'You'
                }
              ]
            };
          }
          return rule;
        }));
        
        showNotification('Success', 'Comment added successfully', 'success');
      }
      
      return comment;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to add comment', 'error');
      return null;
    }
  }, [user, showNotification]);
  
  // Delete a rule
  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      const success = await houseRulesService.deleteHouseRule(ruleId);
      
      if (success) {
        setRules(prev => prev.filter(rule => rule.id !== ruleId));
        showNotification('Success', 'House rule deleted', 'success');
      }
      
      return success;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to delete rule', 'error');
      return false;
    }
  }, [showNotification]);
  
  // Manual refresh function for UI controls
  const refreshRules = useCallback(async () => {
    return fetchRules();
  }, [fetchRules]);
  
  // Load rules on mount and when homeId changes
  useEffect(() => {
    if (homeId) {
      fetchRules();
    } else {
      fetchUserDefaultHome().then(defaultHomeId => {
        if (defaultHomeId) {
          fetchRules(defaultHomeId);
        } else {
          setRules([]);
        }
      });
    }
  }, [homeId, fetchRules, fetchUserDefaultHome]);
  
  return {
    rules,
    loading,
    error,
    homeId: homeId,
    setHomeId,
    fetchRules,
    refreshRules,
    createRule,
    toggleAgreement,
    addComment,
    deleteRule,
  };
};

export default useHouseRules;
