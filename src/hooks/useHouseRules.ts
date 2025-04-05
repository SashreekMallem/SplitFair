import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import * as houseRulesService from '../services/api/houseRulesService';
import { fetchUserHomeMembership } from '../services/api/homeService';
import { HouseRule } from '../services/api/houseRulesService';
import { logDebug, logError } from '../utils/DebugHelper';

export const useHouseRules = (initialHomeId?: string) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [homeId, setHomeId] = useState<string | undefined>(initialHomeId);
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Update homeId if initialHomeId changes
  useEffect(() => {
    logDebug(`HOUSE_RULES_HOOK: initialHomeId changed to: ${initialHomeId}`);
    setHomeId(initialHomeId);
  }, [initialHomeId]);

  // Fetch user's default home if homeId is not provided
  const fetchUserDefaultHome = useCallback(async () => {
    if (!user?.id) {
      logDebug(`HOUSE_RULES_HOOK: No user logged in, cannot fetch default home`);
      return null;
    }
    
    try {
      logDebug(`HOUSE_RULES_HOOK: Attempting to fetch user's default home`);
      const membership = await fetchUserHomeMembership(user.id);
      if (membership && membership.home_id) {
        logDebug(`HOUSE_RULES_HOOK: Found default home: ${membership.home_id}`);
        setHomeId(membership.home_id);
        return membership.home_id;
      }
      logDebug(`HOUSE_RULES_HOOK: No default home found for user`);
      return null;
    } catch (err: any) {
      logError(`HOUSE_RULES_HOOK: Error fetching default home: ${err.message}`);
      return null;
    }
  }, [user]);
  
  // Fetch all rules for a home
  const fetchRules = useCallback(async (targetHomeId?: string) => {
    // Use provided targetHomeId, or fall back to state homeId
    const homeIdToUse = targetHomeId || homeId;
    
    if (!homeIdToUse) {
      logDebug('HOUSE_RULES_HOOK: No homeId provided, attempting to fetch user default home');
      const defaultHomeId = await fetchUserDefaultHome();
      
      if (!defaultHomeId) {
        logDebug('HOUSE_RULES_HOOK: No homeId available, skipping fetch');
        setRules([]);
        setLoading(false);
        return null;
      }
    }
    
    // At this point we should have a valid homeId either from props, params, or user default
    const effectiveHomeId = targetHomeId || homeId || await fetchUserDefaultHome();
    
    if (!effectiveHomeId) {
      logDebug('HOUSE_RULES_HOOK: Still no valid homeId, skipping fetch');
      setRules([]);
      setLoading(false);
      return null;
    }
    
    try {
      logDebug(`HOUSE_RULES_HOOK: Fetching rules for home: ${effectiveHomeId}`);
      setLoading(true);
      setError(null);
      
      const rulesData = await houseRulesService.fetchHouseRules(effectiveHomeId);
      logDebug(`HOUSE_RULES_HOOK: Fetched ${rulesData.length} rules`);
      setRules(rulesData);
      return rulesData;
    } catch (err: any) {
      setError(err.message || 'Failed to load house rules');
      logError(`HOUSE_RULES_HOOK: Error in fetchRules: ${err.message}`);
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
    overrideHomeId?: string // Add this parameter
  ) => {
    if (!user) {
      logError(`HOUSE_RULES_HOOK: createRule aborting - no user logged in`);
      return null;
    }
    
    // Use overrideHomeId, or homeId from state, or try to fetch user's default home
    let targetHomeId = overrideHomeId || homeId;
    
    if (!targetHomeId) {
      logDebug(`HOUSE_RULES_HOOK: No homeId for createRule, attempting to fetch user default`);
      targetHomeId = await fetchUserDefaultHome();
    }
    
    if (!targetHomeId) {
      logError(`HOUSE_RULES_HOOK: createRule aborting - couldn't resolve a valid homeId`);
      return null;
    }
    
    try {
      logDebug(`HOUSE_RULES_HOOK: Creating rule for homeId: ${targetHomeId}`);
      
      const newRule = await houseRulesService.createHouseRule(
        targetHomeId,
        user.id,
        ruleData
      );
      
      if (newRule) {
        logDebug(`HOUSE_RULES_HOOK: Successfully created rule with ID: ${newRule.id}`);
        
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
      } else {
        logError('HOUSE_RULES_HOOK: createRule service returned null');
      }
      
      return newRule;
    } catch (err: any) {
      logError(`HOUSE_RULES_HOOK: Error in createRule: ${err.message}`);
      if (err.stack) logError(`HOUSE_RULES_HOOK: Stack trace: ${err.stack}`);
      showNotification('Error', err.message || 'Failed to create house rule', 'error');
      return null;
    }
  }, [user, homeId, showNotification, fetchUserDefaultHome]);
  
  // Toggle agreement for a rule - updated to handle null homeId case
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
      logError(`HOUSE_RULES_HOOK: Error in toggleAgreement: ${err.message}`);
      return false;
    }
  }, [user, showNotification]);
  
  // Add a comment to a rule - no changes needed except better error logging
  const addComment = useCallback(async (ruleId: string, commentText: string) => {
    if (!user) {
      logError('HOUSE_RULES_HOOK: addComment called but no user is logged in');
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
      logError(`HOUSE_RULES_HOOK: Error in addComment: ${err.message}`);
      return null;
    }
  }, [user, showNotification]);
  
  // Delete a rule - no changes needed except better error logging
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
      logError(`HOUSE_RULES_HOOK: Error in deleteRule: ${err.message}`);
      return false;
    }
  }, [showNotification]);
  
  // Manual refresh function for UI controls
  const refreshRules = useCallback(async () => {
    logDebug('HOUSE_RULES_HOOK: Manual refresh triggered');
    return fetchRules();
  }, [fetchRules]);
  
  // Load rules on mount and when homeId changes
  useEffect(() => {
    if (homeId) {
      logDebug(`HOUSE_RULES_HOOK: homeId changed to: ${homeId}, fetching rules`);
      fetchRules();
    } else {
      logDebug(`HOUSE_RULES_HOOK: homeId changed to: ${homeId}, will attempt to fetch default home`);
      fetchUserDefaultHome().then(defaultHomeId => {
        if (defaultHomeId) {
          fetchRules(defaultHomeId);
        } else {
          logDebug('HOUSE_RULES_HOOK: No homeId available, clearing rules');
          setRules([]);
        }
      });
    }
  }, [homeId, fetchRules, fetchUserDefaultHome]);
  
  return {
    rules,
    loading,
    error,
    homeId: homeId,  // Expose the homeId we're using
    setHomeId,       // Allow manually setting homeId
    fetchRules,      // Expose the fetch function to allow passing a specific homeId
    refreshRules,    // For convenience in UI components
    createRule,
    toggleAgreement,
    addComment,
    deleteRule,
  };
};

export default useHouseRules;
