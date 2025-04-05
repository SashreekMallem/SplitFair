import { supabase } from '../../config/supabase';
import { logDebug, logError } from '../../utils/DebugHelper';

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
    logDebug(`fetchHouseRules: Starting fetch for homeId: ${homeId}`);
    
    // Extra debug logging about current user
    const { data: { user } } = await supabase.auth.getUser();
    logDebug(`fetchHouseRules: Current authenticated user: ${user?.id}`);
    
    // SIMPLIFIED APPROACH: Fetch rules without any joins to avoid relationship errors
    logDebug(`fetchHouseRules: Executing basic query for home_id=${homeId}`);
    
    // Step 1: Get just the house rules data without any joins
    const { data: rules, error, status, count } = await supabase
      .from('house_rules')
      .select('*')  // No joins - just the base table columns
      .eq('home_id', homeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    logDebug(`fetchHouseRules: Query completed with status ${status}, count: ${count || 'unknown'}`);
    
    if (error) {
      logError(`Error fetching house rules: ${error.message}`);
      logError(`Error details: ${JSON.stringify(error)}`);
      return [];
    }

    if (!rules || rules.length === 0) {
      logDebug('fetchHouseRules: No rules found');
      return [];
    }

    logDebug(`fetchHouseRules: Successfully fetched ${rules.length} rules`);
    
    // Step 2: Collect all creator IDs to get their profiles separately
    const creatorIds = [...new Set(rules.map(rule => rule.created_by))];
    
    // Step 3: Get creator profiles 
    let creatorProfiles = {};
    if (creatorIds.length > 0) {
      logDebug(`fetchHouseRules: Fetching user profiles for ${creatorIds.length} creators`);
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
    const { data: agreements, error: agreementsError } = await supabase
      .from('rule_agreements')
      .select('*')
      .in('rule_id', ruleIds);

    if (agreementsError) {
      logError(`Error fetching rule agreements: ${agreementsError.message}`);
      // Continue with empty agreements
    }

    // Fetch comments for all rules in a single query WITHOUT joining to user
    const { data: comments, error: commentsError } = await supabase
      .from('rule_comments')
      .select('*')
      .in('rule_id', ruleIds)
      .order('created_at', { ascending: true });

    if (commentsError) {
      logError(`Error fetching rule comments: ${commentsError.message}`);
      // Continue with empty comments
    }

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
    logError(`Unexpected error in fetchHouseRules: ${error.message}`);
    return [];
  }
};

/**
 * Fetch a single house rule by ID
 */
export const fetchHouseRule = async (ruleId: string): Promise<HouseRule | null> => {
  try {
    logDebug(`Fetching house rule: ${ruleId}`);
    
    // Use the simplified approach - no join with profiles
    const { data: rule, error } = await supabase
      .from('house_rules')
      .select('*')  // No joins
      .eq('id', ruleId)
      .single();
    
    if (error) {
      logError(`Error fetching house rule: ${error.message}`);
      return null;
    }

    if (!rule) {
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
    const { data: agreements, error: agreementsError } = await supabase
      .from('rule_agreements')
      .select('*')
      .eq('rule_id', ruleId);

    if (agreementsError) {
      logError(`Error fetching rule agreements: ${agreementsError.message}`);
      // Continue with empty agreements
    }

    // Fetch comments for this rule without joining
    const { data: comments, error: commentsError } = await supabase
      .from('rule_comments')
      .select('*')
      .eq('rule_id', ruleId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      logError(`Error fetching rule comments: ${commentsError.message}`);
      // Continue with empty comments
    }

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
    logError(`Unexpected error in fetchHouseRule: ${error.message}`);
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
    logDebug(`HOUSE_RULE_SERVICE: Creating new rule - homeId: ${homeId}, userId: ${userId}`);
    logDebug(`HOUSE_RULE_SERVICE: Rule data: ${JSON.stringify(rule)}`);
    
    // First verify the home exists
    logDebug(`HOUSE_RULE_SERVICE: Verifying home exists...`);
    const { data: homeCheck, error: homeCheckError, status: homeStatus } = await supabase
      .from('homes')
      .select('id, name')
      .eq('id', homeId)
      .single();
    
    logDebug(`HOUSE_RULE_SERVICE: Home check response status: ${homeStatus}`);
      
    if (homeCheckError) {
      logError(`HOUSE_RULE_SERVICE: Home verification failed - Error: ${JSON.stringify(homeCheckError)}`);
      logError(`HOUSE_RULE_SERVICE: Error code: ${homeCheckError.code}, Message: ${homeCheckError.message}`);
      return null;
    }

    if (!homeCheck) {
      logError(`HOUSE_RULE_SERVICE: No home found with ID: ${homeId}`);
      return null;
    }
    
    logDebug(`HOUSE_RULE_SERVICE: Home verified: ${homeCheck.name || homeCheck.id}`);
    
    // Verify the user is a member of the home
    logDebug(`HOUSE_RULE_SERVICE: Verifying user membership...`);
    const { data: memberCheck, error: memberCheckError } = await supabase
      .from('home_members')
      .select('id, role')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .single();
    
    if (memberCheckError) {
      logError(`HOUSE_RULE_SERVICE: Membership verification failed: ${memberCheckError.message}`);
      logError(`HOUSE_RULE_SERVICE: Error details: ${JSON.stringify(memberCheckError)}`);
    }
    
    if (!memberCheck) {
      logError(`HOUSE_RULE_SERVICE: User ${userId} is not a member of home ${homeId}`);
      return null;
    }
    
    logDebug(`HOUSE_RULE_SERVICE: User verified as member with role: ${memberCheck.role}`);
    
    const newRule = {
      home_id: homeId,
      created_by: userId,
      title: rule.title,
      description: rule.description,
      category: rule.category,
      is_active: true
    };
    
    logDebug(`HOUSE_RULE_SERVICE: Inserting new rule: ${JSON.stringify(newRule)}`);
    
    const { data, error, status } = await supabase
      .from('house_rules')
      .insert(newRule)
      .select()
      .single();
    
    logDebug(`HOUSE_RULE_SERVICE: Insert response status: ${status}`);
    
    if (error) {
      logError(`HOUSE_RULE_SERVICE: Error creating house rule: ${error.message}`);
      logError(`HOUSE_RULE_SERVICE: Error code: ${error.code}, Details: ${JSON.stringify(error)}`);
      if (error.details) logError(`HOUSE_RULE_SERVICE: Error details: ${error.details}`);
      return null;
    }

    if (!data) {
      logError('HOUSE_RULE_SERVICE: No data returned from insert operation');
      return null;
    }
    
    logDebug(`HOUSE_RULE_SERVICE: Rule created successfully with ID: ${data.id}`);

    // Automatically add the creator as an agreement
    const { error: agreementError } = await supabase
      .from('rule_agreements')
      .insert({
        rule_id: data.id,
        user_id: userId,
      });

    if (agreementError) {
      logError(`HOUSE_RULE_SERVICE: Error creating initial agreement: ${agreementError.message}`);
      logError(`HOUSE_RULE_SERVICE: Full agreement error: ${JSON.stringify(agreementError)}`);
      // Continue despite error, the rule was created successfully
    } else {
      logDebug(`HOUSE_RULE_SERVICE: Creator agreement added successfully`);
    }
    
    return data as HouseRule;
    
  } catch (error: any) {
    logError(`HOUSE_RULE_SERVICE: Unexpected error in createHouseRule: ${error.message}`);
    logError(`HOUSE_RULE_SERVICE: Stack trace: ${error.stack || 'No stack trace'}`);
    if (error.response) {
      logError(`HOUSE_RULE_SERVICE: Response data: ${JSON.stringify(error.response.data)}`);
    }
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
    logDebug(`Updating house rule: ${ruleId}`);
    
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
      logError(`Error updating house rule: ${error.message}`);
      return null;
    }
    
    return data as HouseRule;
    
  } catch (error: any) {
    logError(`Unexpected error in updateHouseRule: ${error.message}`);
    return null;
  }
};

/**
 * Delete a house rule (soft delete by setting is_active to false)
 */
export const deleteHouseRule = async (ruleId: string): Promise<boolean> => {
  try {
    logDebug(`Soft deleting house rule: ${ruleId}`);
    
    const { error } = await supabase
      .from('house_rules')
      .update({
        is_active: false,
        updated_at: new Date(),
      })
      .eq('id', ruleId);
    
    if (error) {
      logError(`Error deleting house rule: ${error.message}`);
      return false;
    }
    
    return true;
    
  } catch (error: any) {
    logError(`Unexpected error in deleteHouseRule: ${error.message}`);
    return false;
  }
};

/**
 * Toggle agreement for a rule
 */
export const toggleRuleAgreement = async (ruleId: string, userId: string): Promise<boolean> => {
  try {
    logDebug(`Toggling rule agreement for rule: ${ruleId}, user: ${userId}`);
    
    // First check if the agreement exists
    const { data: existingAgreement, error: checkError } = await supabase
      .from('rule_agreements')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) {
      logError(`Error checking agreement existence: ${checkError.message}`);
      return false;
    }
    
    if (existingAgreement) {
      // Remove the agreement
      const { error: deleteError } = await supabase
        .from('rule_agreements')
        .delete()
        .eq('rule_id', ruleId)
        .eq('user_id', userId);
      
      if (deleteError) {
        logError(`Error removing agreement: ${deleteError.message}`);
        return false;
      }
      
      return true;
    } else {
      // Add a new agreement
      const { error: insertError } = await supabase
        .from('rule_agreements')
        .insert({
          rule_id: ruleId,
          user_id: userId,
        });
      
      if (insertError) {
        logError(`Error adding agreement: ${insertError.message}`);
        return false;
      }
      
      return true;
    }
    
  } catch (error: any) {
    logError(`Unexpected error in toggleRuleAgreement: ${error.message}`);
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
    logDebug(`Adding comment to rule: ${ruleId}`);
    
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
      logError(`Error adding comment: ${error.message}`);
      return null;
    }
    
    return data as RuleComment;
    
  } catch (error: any) {
    logError(`Unexpected error in addRuleComment: ${error.message}`);
    return null;
  }
};

/**
 * Delete a comment
 */
export const deleteRuleComment = async (commentId: string): Promise<boolean> => {
  try {
    logDebug(`Deleting comment: ${commentId}`);
    
    const { error } = await supabase
      .from('rule_comments')
      .delete()
      .eq('id', commentId);
    
    if (error) {
      logError(`Error deleting comment: ${error.message}`);
      return false;
    }
    
    return true;
    
  } catch (error: any) {
    logError(`Unexpected error in deleteRuleComment: ${error.message}`);
    return false;
  }
};
