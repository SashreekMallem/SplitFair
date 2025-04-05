import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import * as houseRulesService from '../services/api/houseRulesService';
import { fetchUserHomeMembership } from '../services/api/homeService';
import { HouseRule } from '../services/api/houseRulesService';
import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useHouseRules = (initialHomeId?: string) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [homeId, setHomeId] = useState<string | undefined>(initialHomeId);
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // References to realtime subscriptions
  const rulesSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const agreementsSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const commentsSubscriptionRef = useRef<RealtimeChannel | null>(null);
  
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
    const homeIdToUse = targetHomeId || homeId;
    
    if (!homeIdToUse) {
      const defaultHomeId = await fetchUserDefaultHome();
      
      if (!defaultHomeId) {
        setRules([]);
        setLoading(false);
        return null;
      }
    }
    
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

  // Set up real-time subscriptions
  useEffect(() => {
    if (!homeId || !user?.id) {
      return;
    }

    // Clean up any existing subscriptions
    if (rulesSubscriptionRef.current) {
      rulesSubscriptionRef.current.unsubscribe();
      rulesSubscriptionRef.current = null;
    }
    
    if (agreementsSubscriptionRef.current) {
      agreementsSubscriptionRef.current.unsubscribe();
      agreementsSubscriptionRef.current = null;
    }
    
    if (commentsSubscriptionRef.current) {
      commentsSubscriptionRef.current.unsubscribe();
      commentsSubscriptionRef.current = null;
    }
    
    // Create subscription for house_rules table
    const rulesSubscription = supabase
      .channel('house-rules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'house_rules',
          filter: `home_id=eq.${homeId}`
        },
        async (payload) => {
          console.log('Real-time rules update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newRule = payload.new as HouseRule;
            const completeRule = await houseRulesService.fetchHouseRule(newRule.id);
            if (completeRule) {
              setRules(prev => [completeRule, ...prev]);
            }
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedRule = payload.new as HouseRule;
            
            if (updatedRule.is_active) {
              const completeRule = await houseRulesService.fetchHouseRule(updatedRule.id);
              if (completeRule) {
                setRules(prev => prev.map(r => r.id === completeRule.id ? completeRule : r));
              }
            } else {
              setRules(prev => prev.filter(r => r.id !== updatedRule.id));
            }
          }
        }
      )
      .subscribe();
    
    // Create subscription for rule_agreements table
    const agreementsSubscription = supabase
      .channel('rule-agreements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rule_agreements'
        },
        async (payload) => {
          console.log('Real-time agreements update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newAgreement = payload.new;
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('user_id, full_name')
              .eq('user_id', newAgreement.user_id)
              .single();
            
            setRules(prev => prev.map(rule => {
              if (rule.id === newAgreement.rule_id) {
                const userName = userProfile?.full_name || 
                  (newAgreement.user_id === user.id ? 'You' : 'Unknown');
                
                return {
                  ...rule,
                  agreements: [
                    ...(rule.agreements || []),
                    {
                      ...newAgreement,
                      user_name: userName
                    }
                  ]
                };
              }
              return rule;
            }));
          } 
          else if (payload.eventType === 'DELETE') {
            const deletedAgreement = payload.old;
            
            setRules(prev => prev.map(rule => {
              if (rule.id === deletedAgreement.rule_id) {
                return {
                  ...rule,
                  agreements: (rule.agreements || []).filter(a => 
                    a.user_id !== deletedAgreement.user_id
                  )
                };
              }
              return rule;
            }));
          }
        }
      )
      .subscribe();
      
    // Create subscription for rule_comments table  
    const commentsSubscription = supabase
      .channel('rule-comments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rule_comments'
        },
        async (payload) => {
          console.log('Real-time comments update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newComment = payload.new;
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('user_id, full_name')
              .eq('user_id', newComment.user_id)
              .single();
            
            setRules(prev => prev.map(rule => {
              if (rule.id === newComment.rule_id) {
                const userName = userProfile?.full_name || 
                  (newComment.user_id === user.id ? 'You' : 'Unknown');
                
                // Check if this comment already exists in the array
                const commentExists = rule.comments?.some(c => c.id === newComment.id);
                if (commentExists) {
                  // If it exists, just return the rule as is
                  return rule;
                }
                
                return {
                  ...rule,
                  comments: [
                    ...(rule.comments || []),
                    {
                      ...newComment,
                      user_name: userName,
                      // Add a clientId to ensure uniqueness if needed
                      clientId: `${newComment.id}-${Date.now()}`
                    }
                  ]
                };
              }
              return rule;
            }));
          }
        }
      )
      .subscribe();
    
    // Store subscription references
    rulesSubscriptionRef.current = rulesSubscription;
    agreementsSubscriptionRef.current = agreementsSubscription;
    commentsSubscriptionRef.current = commentsSubscription;
    
    // Clean up on unmount or when homeId changes
    return () => {
      if (rulesSubscriptionRef.current) {
        rulesSubscriptionRef.current.unsubscribe();
        rulesSubscriptionRef.current = null;
      }
      
      if (agreementsSubscriptionRef.current) {
        agreementsSubscriptionRef.current.unsubscribe();
        agreementsSubscriptionRef.current = null;
      }
      
      if (commentsSubscriptionRef.current) {
        commentsSubscriptionRef.current.unsubscribe();
        commentsSubscriptionRef.current = null;
      }
    };
  }, [homeId, user]);
  
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
  
  // Update a rule
  const updateRule = useCallback(async (
    ruleId: string,
    ruleData: {
      title?: string;
      description?: string;
      category?: string;
    }
  ) => {
    try {
      const updatedRule = await houseRulesService.updateHouseRule(ruleId, ruleData);
      
      if (updatedRule) {
        // Optimistically update the UI
        setRules(prev => prev.map(rule => 
          rule.id === ruleId 
            ? { ...rule, ...ruleData, updated_at: new Date().toISOString() } 
            : rule
        ));
        
        showNotification('Success', 'House rule updated successfully', 'success');
      }
      
      return updatedRule;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to update house rule', 'error');
      return null;
    }
  }, [showNotification]);
  
  // Toggle agreement for a rule
  const toggleAgreement = useCallback(async (ruleId: string) => {
    if (!user) return false;
    
    try {
      const success = await houseRulesService.toggleRuleAgreement(ruleId, user.id);
      
      if (success) {
        setRules(prev => prev.map(rule => {
          if (rule.id === ruleId) {
            const userAgreement = rule.agreements?.find(a => a.user_id === user.id);
            
            if (userAgreement) {
              return {
                ...rule,
                agreements: rule.agreements?.filter(a => a.user_id !== user.id) || []
              };
            } else {
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
    refreshRules: fetchRules, // Alias for consistency
    createRule,
    updateRule, // Add this
    toggleAgreement,
    addComment,
    deleteRule,
  };
};

export default useHouseRules;
