import { supabase } from '../../config/supabase';
import { createHomeNotification, createUserNotification } from './notificationService';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'missed';
export type TaskDifficulty = 'easy' | 'medium' | 'hard';
export type RepeatFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface Task {
  id: string;
  home_id: string;
  title: string;
  description?: string;
  category: string;
  icon?: string;
  status: TaskStatus;
  due_date?: string; // ISO format date string
  created_by: string;
  assigned_to?: string;
  difficulty?: TaskDifficulty;
  estimated_minutes?: number;
  rotation_enabled: boolean;
  repeat_frequency?: RepeatFrequency;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  
  // Joined fields (not in the actual table)
  assigned_to_name?: string;
  created_by_name?: string;
  completion_history?: TaskCompletion[];
  rotation_members?: TaskRotationMember[];
}

export interface TaskRotationMember {
  id: string;
  task_id: string;
  user_id: string;
  rotation_order: number;
  created_at: string;
  
  // Joined fields
  user_name?: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_by?: string;
  completion_date: string;
  status: 'completed' | 'missed';
  rating?: 'poor' | 'good' | 'excellent';
  evaluated_by?: string;
  notes?: string;
  created_at: string;
  
  // Joined fields
  completed_by_name?: string;
  evaluated_by_name?: string;
}

export interface TaskSwapRequest {
  id: string;
  task_id: string;
  requested_by: string;
  requested_to: string;
  original_date: string;
  proposed_date: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  
  // Joined fields
  requested_by_name?: string;
  requested_to_name?: string;
  task_title?: string;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  category: string;
  icon?: string;
  due_date?: string;
  assigned_to?: string;
  difficulty?: TaskDifficulty;
  estimated_minutes?: number;
  rotation_enabled: boolean;
  repeat_frequency?: RepeatFrequency;
  rotation_members?: string[]; // Array of user IDs
  time_slot?: string; // Add time slot for availability tracking
}

/**
 * Fetch tasks for a home
 */
export const fetchTasks = async (
  homeId: string, 
  status?: TaskStatus, 
  assignedTo?: string
): Promise<Task[]> => {
  try {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        rotation_members:task_rotation_members(id, user_id, rotation_order),
        completion_history:task_history(id, completed_by, completion_date, status, rating)
      `)
      .eq('home_id', homeId)
      .eq('is_active', true)
      .order('due_date', { ascending: true });
      
    if (status) {
      query = query.eq('status', status);
    }
    
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    
    const { data, error } = await query;
    
    if (error || !data) {
      console.error('Error fetching tasks:', error);
      return [];
    }
    
    // Process the tasks to add additional information
    const enhancedTasks = await enhanceTasksWithNames(data);
    
    return enhancedTasks;
  } catch (error) {
    console.error('Unexpected error in fetchTasks:', error);
    return [];
  }
};

/**
 * Enhance tasks with user names for assigned_to and created_by
 */
const enhanceTasksWithNames = async (tasks: Task[]): Promise<Task[]> => {
  if (!tasks || tasks.length === 0) return [];
  
  // Collect all user IDs that need names
  const userIds = new Set<string>();
  
  tasks.forEach(task => {
    if (task.assigned_to) userIds.add(task.assigned_to);
    if (task.created_by) userIds.add(task.created_by);
    
    // Add user IDs from rotation members
    if (task.rotation_members) {
      task.rotation_members.forEach(member => {
        if (member.user_id) userIds.add(member.user_id);
      });
    }
    
    // Add user IDs from completion history
    if (task.completion_history) {
      task.completion_history.forEach(completion => {
        if (completion.completed_by) userIds.add(completion.completed_by);
        if (completion.evaluated_by) userIds.add(completion.evaluated_by);
      });
    }
  });
  
  // Fetch user profiles for all collected IDs
  if (userIds.size === 0) return tasks;
  
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', Array.from(userIds));
    
  if (!profiles) return tasks;
  
  // Create a map for easy lookups
  const nameMap = profiles.reduce((acc, profile) => {
    acc[profile.user_id] = profile.full_name;
    return acc;
  }, {} as Record<string, string>);
  
  // Get current user ID for "You" replacement
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  
  // Enhance tasks with names
  return tasks.map(task => {
    const enhancedTask = { ...task };
    
    // Add assigned_to name
    if (task.assigned_to) {
      enhancedTask.assigned_to_name = task.assigned_to === currentUserId ? 
        'You' : (nameMap[task.assigned_to] || 'Unknown');
    }
    
    // Add created_by name
    if (task.created_by) {
      enhancedTask.created_by_name = task.created_by === currentUserId ? 
        'You' : (nameMap[task.created_by] || 'Unknown');
    }
    
    // Add names to rotation members
    if (task.rotation_members) {
      enhancedTask.rotation_members = task.rotation_members.map(member => ({
        ...member,
        user_name: member.user_id === currentUserId ? 
          'You' : (nameMap[member.user_id] || 'Unknown')
      }));
    }
    
    // Add names to completion history
    if (task.completion_history) {
      enhancedTask.completion_history = task.completion_history.map(completion => ({
        ...completion,
        completed_by_name: completion.completed_by === currentUserId ? 
          'You' : (nameMap[completion.completed_by || ''] || 'Unknown'),
        evaluated_by_name: completion.evaluated_by === currentUserId ? 
          'You' : (nameMap[completion.evaluated_by || ''] || 'Unknown')
      }));
    }
    
    return enhancedTask;
  });
};

/**
 * Create a new task
 */
export const createTask = async (
  homeId: string, 
  userId: string, 
  taskData: CreateTaskParams
): Promise<Task | null> => {
  try {
    // Create the task
    const newTask = {
      home_id: homeId,
      created_by: userId,
      title: taskData.title,
      description: taskData.description || '',
      category: taskData.category,
      icon: taskData.icon,
      status: 'pending' as TaskStatus,
      due_date: taskData.due_date,
      assigned_to: taskData.assigned_to || userId, // Default to creator if not specified
      difficulty: taskData.difficulty,
      estimated_minutes: taskData.estimated_minutes,
      rotation_enabled: taskData.rotation_enabled,
      repeat_frequency: taskData.repeat_frequency,
      time_slot: taskData.time_slot || 'morning', // Default to morning if not specified
    };
    
    const { data: task, error } = await supabase
      .from('tasks')
      .insert(newTask)
      .select()
      .single();
    
    if (error || !task) {
      console.error('Error creating task:', error);
      return null;
    }
    
    // If rotation enabled, add rotation members
    if (taskData.rotation_enabled && taskData.rotation_members && taskData.rotation_members.length > 0) {
      const rotationMembers = taskData.rotation_members.map((memberId, index) => ({
        task_id: task.id,
        user_id: memberId,
        rotation_order: index + 1
      }));
      
      const { error: rotationError } = await supabase
        .from('task_rotation_members')
        .insert(rotationMembers);
      
      if (rotationError) {
        console.error('Error adding rotation members:', rotationError);
      }
    }
    
    // Get user's name for notification
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();
      
    const userName = userProfile?.full_name || 'A user';
    
    // Notify all home members about the new task
    await createHomeNotification(
      homeId,
      'New Task Created',
      `${userName} created a new task: ${taskData.title}`,
      'info',
      'tasks',
      task.id
    );
    
    // If task is assigned to someone else, notify them
    if (taskData.assigned_to && taskData.assigned_to !== userId) {
      await createUserNotification(
        taskData.assigned_to,
        homeId,
        'New Task Assigned',
        `${userName} assigned you a task: ${taskData.title}`,
        'info',
        'tasks',
        task.id
      );
    }
    
    // Return the created task with enhanced info
    const enhancedTasks = await enhanceTasksWithNames([task]);
    return enhancedTasks[0] || task;
    
  } catch (error) {
    console.error('Unexpected error in createTask:', error);
    return null;
  }
};

/**
 * Update a task
 */
export const updateTask = async (
  taskId: string, 
  updates: Partial<Task>
): Promise<Task | null> => {
  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();
    
    if (error || !task) {
      console.error('Error updating task:', error);
      return null;
    }
    
    // Return the updated task with enhanced info
    const enhancedTasks = await enhanceTasksWithNames([task]);
    return enhancedTasks[0] || task;
    
  } catch (error) {
    console.error('Unexpected error in updateTask:', error);
    return null;
  }
};

/**
 * Mark a task as complete
 */
export const completeTask = async (
  taskId: string,
  userId: string,
  completionDate: string = new Date().toISOString().split('T')[0]
): Promise<boolean> => {
  try {
    // Update the task status
    const { data: task, error } = await supabase
      .from('tasks')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select('*')
      .single();
    
    if (error || !task) {
      console.error('Error completing task:', error);
      return false;
    }
    
    // Add entry to task history
    const { error: historyError } = await supabase
      .from('task_history')
      .insert({
        task_id: taskId,
        completed_by: userId,
        completion_date: completionDate,
        status: 'completed'
      });
    
    if (historyError) {
      console.error('Error adding task history:', historyError);
      // Still return true since the task status was updated
    }
    
    // Handle task rotation if enabled
    if (task.rotation_enabled) {
      await rotateTaskAssignment(taskId);
    }
    
    // Get user's name for notification
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single();
      
    const userName = userProfile?.full_name || 'A user';
    
    // Notify creator if different from the completer
    if (task.created_by !== userId) {
      await createUserNotification(
        task.created_by,
        task.home_id,
        'Task Completed',
        `${userName} completed the task: ${task.title}`,
        'success',
        'tasks',
        task.id
      );
    }
    
    return true;
    
  } catch (error) {
    console.error('Unexpected error in completeTask:', error);
    return false;
  }
};

/**
 * Rotate task assignment to the next person in rotation
 */
const rotateTaskAssignment = async (taskId: string): Promise<boolean> => {
  try {
    // Get the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (taskError || !task || !task.rotation_enabled) {
      return false;
    }
    
    // Get rotation members
    const { data: members, error: membersError } = await supabase
      .from('task_rotation_members')
      .select('*')
      .eq('task_id', taskId)
      .order('rotation_order', { ascending: true });
    
    if (membersError || !members || members.length === 0) {
      return false;
    }
    
    // Find current assignee's position
    const currentIndex = members.findIndex(m => m.user_id === task.assigned_to);
    
    // Calculate next assignee (circular)
    const nextIndex = (currentIndex + 1) % members.length;
    const nextAssignee = members[nextIndex].user_id;
    
    // Update task assignment
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ 
        assigned_to: nextAssignee,
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId);
    
    if (updateError) {
      console.error('Error rotating task assignment:', updateError);
      return false;
    }
    
    // Get names for notification
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', [task.assigned_to, nextAssignee]);
      
    const nameMap = profiles?.reduce((acc, profile) => {
      acc[profile.user_id] = profile.full_name;
      return acc;
    }, {} as Record<string, string>) || {};
    
    // Notify the new assignee
    await createUserNotification(
      nextAssignee,
      task.home_id,
      'Task Assigned to You',
      `It's now your turn to do: ${task.title}`,
      'info',
      'tasks',
      task.id
    );
    
    return true;
    
  } catch (error) {
    console.error('Unexpected error in rotateTaskAssignment:', error);
    return false;
  }
};

/**
 * Request a task swap
 */
export const requestTaskSwap = async (
  taskId: string,
  requestedByUserId: string,
  requestedToUserId: string,
  originalDate: string,
  proposedDate: string,
  message?: string
): Promise<TaskSwapRequest | null> => {
  try {
    // Create the swap request
    const { data: swapRequest, error } = await supabase
      .from('task_swap_requests')
      .insert({
        task_id: taskId,
        requested_by: requestedByUserId,
        requested_to: requestedToUserId,
        original_date: originalDate,
        proposed_date: proposedDate,
        message: message || '',
        status: 'pending'
      })
      .select()
      .single();
    
    if (error || !swapRequest) {
      console.error('Error creating swap request:', error);
      return null;
    }
    
    // Get task details
    const { data: task } = await supabase
      .from('tasks')
      .select('title, home_id')
      .eq('id', taskId)
      .single();
    
    if (!task) {
      return swapRequest;
    }
    
    // Get user name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', requestedByUserId)
      .single();
      
    const userName = userProfile?.full_name || 'A user';
    
    // Notify the requested user
    await createUserNotification(
      requestedToUserId,
      task.home_id,
      'Task Swap Request',
      `${userName} wants to swap task: ${task.title}`,
      'info',
      'task_swap',
      swapRequest.id
    );
    
    return {
      ...swapRequest,
      task_title: task.title
    };
    
  } catch (error) {
    console.error('Unexpected error in requestTaskSwap:', error);
    return null;
  }
};

/**
 * Respond to a swap request
 */
export const respondToSwapRequest = async (
  swapRequestId: string,
  accept: boolean
): Promise<boolean> => {
  try {
    const status = accept ? 'accepted' : 'rejected';
    
    // Get the swap request first to get related info
    const { data: swapRequest, error: fetchError } = await supabase
      .from('task_swap_requests')
      .select('*, task:tasks(title, home_id)')
      .eq('id', swapRequestId)
      .single();
    
    if (fetchError || !swapRequest) {
      console.error('Error fetching swap request:', fetchError);
      return false;
    }
    
    // Update the swap request status
    const { error } = await supabase
      .from('task_swap_requests')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', swapRequestId);
    
    if (error) {
      console.error('Error updating swap request:', error);
      return false;
    }
    
    // Get user names
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', [swapRequest.requested_by, swapRequest.requested_to]);
      
    const nameMap = profiles?.reduce((acc, profile) => {
      acc[profile.user_id] = profile.full_name;
      return acc;
    }, {} as Record<string, string>) || {};
    
    const requesterName = nameMap[swapRequest.requested_by] || 'A user';
    const responderName = nameMap[swapRequest.requested_to] || 'A user';
    const taskTitle = (swapRequest.task as any)?.title || 'a task';
    const homeId = (swapRequest.task as any)?.home_id;
    
    if (accept) {
      // If accepted, swap the task assignments
      // This is a simplified version - in a real app you might need to handle
      // more complex swap logic depending on your requirements
      
      // Notify the requester
      await createUserNotification(
        swapRequest.requested_by,
        homeId,
        'Swap Request Accepted',
        `${responderName} accepted your swap request for: ${taskTitle}`,
        'success',
        'task_swap',
        swapRequest.id
      );
      
      // You would also typically update task assignments here
    } else {
      // Notify the requester
      await createUserNotification(
        swapRequest.requested_by,
        homeId,
        'Swap Request Declined',
        `${responderName} declined your swap request for: ${taskTitle}`,
        'info',
        'task_swap',
        swapRequest.id
      );
    }
    
    return true;
    
  } catch (error) {
    console.error('Unexpected error in respondToSwapRequest:', error);
    return false;
  }
};

/**
 * Fetch task swap requests for a user
 */
export const fetchSwapRequests = async (
  userId: string,
  status?: 'pending' | 'accepted' | 'rejected'
): Promise<TaskSwapRequest[]> => {
  try {
    let query = supabase
      .from('task_swap_requests')
      .select(`
        *,
        task:tasks(id, title)
      `)
      .or(`requested_by.eq.${userId},requested_to.eq.${userId}`)
      .order('created_at', { ascending: false });
      
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error || !data) {
      console.error('Error fetching swap requests:', error);
      return [];
    }
    
    // Get current user ID for "You" replacement
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    
    // Collect all user IDs that need names
    const userIds = new Set<string>();
    
    data.forEach(request => {
      userIds.add(request.requested_by);
      userIds.add(request.requested_to);
    });
    
    // Fetch user profiles for all collected IDs
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', Array.from(userIds));
      
    if (!profiles) return data;
    
    // Create a map for easy lookups
    const nameMap = profiles.reduce((acc, profile) => {
      acc[profile.user_id] = profile.full_name;
      return acc;
    }, {} as Record<string, string>);
    
    // Enhance requests with names and task titles
    return data.map(request => ({
      ...request,
      requested_by_name: request.requested_by === currentUserId ? 
        'You' : (nameMap[request.requested_by] || 'Unknown'),
      requested_to_name: request.requested_to === currentUserId ? 
        'You' : (nameMap[request.requested_to] || 'Unknown'),
      task_title: (request.task as any)?.title || 'Unknown task'
    }));
    
  } catch (error) {
    console.error('Unexpected error in fetchSwapRequests:', error);
    return [];
  }
};
