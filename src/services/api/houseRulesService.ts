import { supabase } from '../../config/supabase';
import { createHomeNotification, createUserNotification } from './notificationService';

export type HouseRule = {
  id: string;
  home_id: string;
  title: string;
  description: string;
  category: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Additional fields from joins that aren't in the actual table
  creator_name?: string;
  agreements?: RuleAgreement[];
  comments?: RuleComment[];
};

export type RuleAgreement = {
  id: string;
  rule_id: string;
  user_id: string;
  user_name?: string; // Joined field
  agreed_at: string;
};

export type RuleComment = {
  id: string;
  rule_id: string;
  user_id: string;
  user_name?: string; // Joined field
  text: string;
  created_at: string;
  updated_at: string;
};

/**
 * Fetch all house rules for the user's home
 */
export const fetchHouseRules = async (homeId: string): Promise<HouseRule[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Step 1: Get just the house rules data without any joins
    const { data: rules, error } = await supabase
      .from('house_rules')
      .select('*')
      .eq('home_id', homeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      return [];
    }

    if (!rules || rules.length === 0) {
      return [];
    }
    
    // Step 2: Collect all creator IDs to get their profiles separately
    const creatorIds = [...new Set(rules.map(rule => rule.created_by))];
    
    // Step 3: Get creator profiles 
    let creatorProfiles = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', creatorIds);
        
      if (profiles && profiles.length > 0) {
        creatorProfiles = profiles.reduce((map, profile) => {
          map[profile.user_id] = profile;
          return map;
        }, {});
      }
    }
    
    // Format the rules with creator names
    const formattedRules = rules.map(rule => ({
      ...rule,
      creator_name: creatorProfiles[rule.created_by]?.full_name || 
                    (rule.created_by === user?.id ? 'You' : 'Unknown'),
    }));

    // Get the rule IDs for further queries
    const ruleIds = formattedRules.map(rule => rule.id);

    // Fetch agreements for all rules in a single query WITHOUT joining to user
    const { data: agreements } = await supabase
      .from('rule_agreements')
      .select('*')
      .in('rule_id', ruleIds);

    // Fetch comments for all rules in a single query WITHOUT joining to user
    const { data: comments } = await supabase
      .from('rule_comments')
      .select('*')
      .in('rule_id', ruleIds)
      .order('created_at', { ascending: true });

    // If we have agreements or comments, fetch user profiles separately
    const userIds = new Set<string>();
    
    if (agreements) {
      agreements.forEach(agreement => {
        userIds.add(agreement.user_id);
      });
    }
    
    if (comments) {
      comments.forEach(comment => {
        userIds.add(comment.user_id);
      });
    }
    
    // Only fetch profiles if we have user IDs to look up
    let userProfiles = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));
        
      if (profiles) {
        userProfiles = profiles.reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {});
      }
    }

    // Create a map for efficient lookup
    const agreementsByRuleId = {};
    const commentsByRuleId = {};

    // Organize agreements by rule_id with separate user info lookup
    if (agreements) {
      agreements.forEach(agreement => {
        if (!agreementsByRuleId[agreement.rule_id]) {
          agreementsByRuleId[agreement.rule_id] = [];
        }
        
        agreementsByRuleId[agreement.rule_id].push({
          ...agreement,
          user_name: userProfiles[agreement.user_id]?.full_name || 'Unknown'
        });
      });
    }

    // Organize comments by rule_id with separate user info lookup
    if (comments) {
      comments.forEach(comment => {
        if (!commentsByRuleId[comment.rule_id]) {
          commentsByRuleId[comment.rule_id] = [];
        }
        
        commentsByRuleId[comment.rule_id].push({
          ...comment,
          user_name: userProfiles[comment.user_id]?.full_name || 'Unknown'
        });
      });
    }

    // Combine all data into the final rules array
    return formattedRules.map(rule => ({
      ...rule,
      agreements: agreementsByRuleId[rule.id] || [],
      comments: commentsByRuleId[rule.id] || []
    }));
    
  } catch (error: any) {
    return [];
  }
};

/**
 * Fetch a single house rule by ID
 */
export const fetchHouseRule = async (ruleId: string): Promise<HouseRule | null> => {
  try {
    // Use the simplified approach - no join with profiles
    const { data: rule, error } = await supabase
      .from('house_rules')
      .select('*')
      .eq('id', ruleId)
      .single();
    
    if (error || !rule) {
      return null;
    }

    // Get creator name separately
    let creatorName = 'Unknown';
    const { data: creatorProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', rule.created_by)
      .single();
        
    if (creatorProfile) {
      creatorName = creatorProfile.full_name;
    } else if (rule.created_by === (await supabase.auth.getUser()).data.user?.id) {
      creatorName = 'You';
    }

    // Format with creator name
    const formattedRule = {
      ...rule,
      creator_name: creatorName,
    };

    // Fetch agreements for this rule without joining
    const { data: agreements } = await supabase
      .from('rule_agreements')
      .select('*')
      .eq('rule_id', ruleId);

    // Fetch comments for this rule without joining
    const { data: comments } = await supabase
      .from('rule_comments')
      .select('*')
      .eq('rule_id', ruleId)
      .order('created_at', { ascending: true });

    // If we have agreements or comments, fetch user profiles separately
    const userIds = new Set<string>();
    
    if (agreements) {
      agreements.forEach(agreement => {
        userIds.add(agreement.user_id);
      });
    }
    
    if (comments) {
      comments.forEach(comment => {
        userIds.add(comment.user_id);
      });
    }
    
    // Only fetch profiles if we have user IDs to look up
    let userProfiles = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));
        
      if (profiles) {
        userProfiles = profiles.reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {});
      }
    }

    // Format agreements with user names from separate lookup
    const formattedAgreements = agreements 
      ? agreements.map(agreement => ({
          ...agreement,
          user_name: userProfiles[agreement.user_id]?.full_name || 'Unknown'
        }))
      : [];

    // Format comments with user names from separate lookup
    const formattedComments = comments
      ? comments.map(comment => ({
          ...comment,
          user_name: userProfiles[comment.user_id]?.full_name || 'Unknown'
        }))
      : [];

    // Return the complete rule with related data
    return {
      ...formattedRule,
      agreements: formattedAgreements,
      comments: formattedComments
    };
    
  } catch (error: any) {
    return null;
  }
};

/**
 * Create a new house rule
 */
export const createHouseRule = async (
  homeId: string,
  userId: string,
  rule: { title: string; description: string; category: string }
): Promise<HouseRule | null> => {
  try {
    // First verify the home exists
    const { data: homeCheck, error: homeCheckError } = await supabase
      .from('homes')
      .select('id, name')
      .eq('id', homeId)
      .single();
      
    if (homeCheckError || !homeCheck) {
      return null;
    }
    
    // Verify the user is a member of the home
    const { data: memberCheck, error: memberCheckError } = await supabase
      .from('home_members')
      .select('id, role')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .single();
    
    if (memberCheckError || !memberCheck) {
      return null;
    }
    
    const newRule = {
      home_id: homeId,
      created_by: userId,
      title: rule.title,
      description: rule.description,
      category: rule.category,
      is_active: true
    };
    
    const { data, error } = await supabase
      .from('house_rules')
      .insert(newRule)
      .select()
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Get user's name for notification
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();
      
    const userName = userProfile?.full_name || 'A user';
    
    // Create a notification for all home members about the new rule
    await createHomeNotification(
      homeId,
      'New House Rule Added',
      `${userName} created a new house rule: ${rule.title}`,
      'info',
      'house_rules',
      data.id
    );
    
    // Automatically add the creator as an agreement
    await supabase
      .from('rule_agreements')
      .insert({
        rule_id: data.id,
        user_id: userId,
      });
    
    return data as HouseRule;
    
  } catch (error: any) {
    return null;
  }
};

/**
 * Update an existing house rule
 */
export const updateHouseRule = async (
  ruleId: string,
  updates: { title?: string; description?: string; category?: string; is_active?: boolean }
): Promise<HouseRule | null> => {
  try {
    const { data, error } = await supabase
      .from('house_rules')
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .eq('id', ruleId)
      .select()
      .single();
    
    if (error) {
      return null;
    }
    
    return data as HouseRule;
    
  } catch (error: any) {
    return null;
  }
};

/**
 * Delete a house rule (soft delete by setting is_active to false)
 */
export const deleteHouseRule = async (ruleId: string): Promise<boolean> => {
  try {
    // Get rule details before deleting
    const { data: rule } = await supabase
      .from('house_rules')
      .select('title, home_id, created_by')
      .eq('id', ruleId)
      .single();
      
    if (!rule) {
      return false;
    }
    
    const { error } = await supabase
      .from('house_rules')
      .update({
        is_active: false,
        updated_at: new Date(),
      })
      .eq('id', ruleId);
    
    if (!error) {
      // Get user name
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', rule.created_by)
        .single();
        
      const userName = userProfile?.full_name || 'A user';
      
      // Create a notification for all home members about the deleted rule
      await createHomeNotification(
        rule.home_id,
        'House Rule Removed',
        `${userName}'s rule "${rule.title}" has been removed`,
        'info',
        'house_rules'
      );
    }
    
    return !error;
    
  } catch (error: any) {
    return false;
  }
};

/**
 * Toggle agreement for a rule
 */
export const toggleRuleAgreement = async (ruleId: string, userId: string): Promise<boolean> => {
  try {
    // First check if the agreement exists
    const { data: existingAgreement, error: checkError } = await supabase
      .from('rule_agreements')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) {
      return false;
    }
    
    // Get rule details for notification
    const { data: rule } = await supabase
      .from('house_rules')
      .select('title, home_id, created_by')
      .eq('id', ruleId)
      .single();
      
    if (!rule) {
      return false;
    }
    
    // Get user name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();
      
    const userName = userProfile?.full_name || 'A user';
    
    if (existingAgreement) {
      // Remove the agreement
      const { error: deleteError } = await supabase
        .from('rule_agreements')
        .delete()
        .eq('rule_id', ruleId)
        .eq('user_id', userId);
      
      // Create a notification for rule creator if they're not the one withdrawing
      if (rule.created_by !== userId) {
        await createUserNotification(
          rule.created_by,
          rule.home_id,
          'Agreement Withdrawn',
          `${userName} no longer agrees with your rule: ${rule.title}`,
          'info',
          'house_rules',
          ruleId
        );
      }
      
      return !deleteError;
    } else {
      // Add a new agreement
      const { error: insertError } = await supabase
        .from('rule_agreements')
        .insert({
          rule_id: ruleId,
          user_id: userId,
        });
      
      // Create a notification for rule creator if they're not the one agreeing
      if (rule.created_by !== userId) {
        await createUserNotification(
          rule.created_by,
          rule.home_id,
          'New Agreement',
          `${userName} agreed with your rule: ${rule.title}`,
          'success',
          'house_rules',
          ruleId
        );
      }
      
      return !insertError;
    }
    
  } catch (error: any) {
    return false;
  }
};

/**
 * Add a comment to a rule
 */
export const addRuleComment = async (
  ruleId: string,
  userId: string,
  text: string
): Promise<RuleComment | null> => {
  try {
    const { data, error } = await supabase
      .from('rule_comments')
      .insert({
        rule_id: ruleId,
        user_id: userId,
        text: text,
      })
      .select()
      .single();
    
    if (error) {
      return null;
    }
    
    // Get rule details
    const { data: rule } = await supabase
      .from('house_rules')
      .select('title, home_id, created_by')
      .eq('id', ruleId)
      .single();
      
    if (!rule) {
      return data as RuleComment;
    }
    
    // Get user name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();
      
    const userName = userProfile?.full_name || 'A user';
    
    // Create a notification for rule creator if they're not the commenter
    if (rule.created_by !== userId) {
      await createUserNotification(
        rule.created_by,
        rule.home_id,
        'New Comment',
        `${userName} commented on your rule: ${rule.title}`,
        'info',
        'house_rules',
        ruleId
      );
    }
    
    // Create a notification for all home members about the new comment
    await createHomeNotification(
      rule.home_id,
      'New House Rule Comment',
      `${userName} commented on the rule: ${rule.title}`,
      'info',
      'house_rules',
      ruleId
    );
    
    return data as RuleComment;
    
  } catch (error: any) {
    return null;
  }
};

/**
 * Delete a comment
 */
export const deleteRuleComment = async (commentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('rule_comments')
      .delete()
      .eq('id', commentId);
    
    return !error;
    
  } catch (error: any) {
    return false;
  }
};
