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
  assigned_to?: string | string[]; // Updated to handle both string and array
  requires_multiple_people: boolean; // New property for multiple assignees
  difficulty?: TaskDifficulty;
  estimated_minutes?: number;
  rotation_enabled: boolean;
  repeat_frequency?: RepeatFrequency;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  
  // Joined fields (not in the actual table)
  assigned_to_name?: string;
  assigned_to_names?: string[]; // For multiple assignees
  created_by_name?: string;
  completion_history?: TaskCompletion[];
  rotation_members?: TaskRotationMember[];
  assignees?: TaskAssignee[]; // New property for multiple assignees
}

// New interface for task assignees
export interface TaskAssignee {
  user_id: string;
  assignment_order: number;
  user_name?: string; // For display purposes
}

// Rest of existing interfaces...
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
  day_of_week: string; // The day the task is assigned
  assigned_to?: string | string[]; // Updated to handle both string and array
  requires_multiple_people?: boolean; // New parameter 
  difficulty?: TaskDifficulty;
  estimated_minutes?: number;
  rotation_enabled: boolean;
  repeat_frequency?: RepeatFrequency;
  rotation_members?: string[]; // Array of user IDs
  time_slot?: string; // Add time slot for availability tracking
}

// Helper function to get a date from a day of week
export const getDateFromDayOfWeek = (dayInput: string): string => {
  // Check if the input is already a full date string (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayInput)) {
    return dayInput;
  }
  
  // Otherwise, treat it as a day of week abbreviation
  const today = new Date();
  const dayMap: {[key: string]: number} = {
    'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
  };
  
  const targetDay = dayMap[dayInput.toLowerCase()];
  if (targetDay === undefined) {
    console.error("Invalid day of week format:", dayInput);
    return new Date().toISOString().split('T')[0]; // Return today as fallback
  }
  
  // Calculate the next occurrence of this day
  const daysToAdd = (targetDay + 7 - today.getDay()) % 7;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);
  
  // Format as YYYY-MM-DD
  return targetDate.toISOString().split('T')[0];
};

/**
 * Fetch tasks for a home
 */
export const fetchTasks = async (
  homeId: string, 
  status?: TaskStatus, 
  assignedTo?: string
): Promise<Task[]> => {
  try {
    // First, fetch tasks with their basic info
    let query = supabase
      .from('tasks')
      .select(`
        *,
        rotation_members:task_rotation_members(id, user_id, rotation_order),
        completion_history:task_history(id, completed_by, completion_date, status, rating),
        assignees:task_assignees(user_id, assignment_order)
      `)
      .eq('home_id', homeId)
      .eq('is_active', true)
      .order('due_date', { ascending: true });
      
    if (status) {
      query = query.eq('status', status);
    }
    
    // If filtering by assignee, need to handle both direct assignment and multiple assignees
    if (assignedTo) {
      // This is a complex query that needs to check both the tasks.assigned_to field
      // and the task_assignees table for the user
      query = query.or(`assigned_to.eq.${assignedTo},assignees.user_id.eq.${assignedTo}`);
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
    if (task.created_by) userIds.add(task.created_by);
    
    // Handle single assignee in the old field
    if (task.assigned_to && typeof task.assigned_to === 'string') {
      userIds.add(task.assigned_to);
    }
    
    // Handle multiple assignees from assignees array
    if (task.assignees && Array.isArray(task.assignees)) {
      task.assignees.forEach(assignee => {
        if (assignee.user_id) userIds.add(assignee.user_id);
      });
    }
    
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
    
    // Create an array of assigned_to IDs combining both sources
    const assigneeIds: string[] = [];
    
    // Add the single assignee if it exists
    if (typeof task.assigned_to === 'string' && task.assigned_to) {
      assigneeIds.push(task.assigned_to);
    }
    
    // Add assignees from the assignees array
    if (task.assignees && Array.isArray(task.assignees)) {
      // Sort by assignment_order
      const sortedAssignees = [...task.assignees].sort((a, b) => 
        (a.assignment_order || 0) - (b.assignment_order || 0)
      );
      
      sortedAssignees.forEach(assignee => {
        if (!assigneeIds.includes(assignee.user_id)) {
          assigneeIds.push(assignee.user_id);
        }
      });
      
      // Update the assigned_to to be an array if requires_multiple_people is true
      if (task.requires_multiple_people) {
        enhancedTask.assigned_to = assigneeIds;
      }
      
      // Add names to the assignees
      enhancedTask.assignees = sortedAssignees.map(assignee => ({
        ...assignee,
        user_name: assignee.user_id === currentUserId ? 
          'You' : (nameMap[assignee.user_id] || 'Unknown')
      }));
    }
    
    // Add assigned_to name for single assignee case
    if (typeof task.assigned_to === 'string' && task.assigned_to) {
      enhancedTask.assigned_to_name = task.assigned_to === currentUserId ? 
        'You' : (nameMap[task.assigned_to] || 'Unknown');
    }
    
    // Add assigned_to_names array for multiple assignees
    if (assigneeIds.length > 0) {
      enhancedTask.assigned_to_names = assigneeIds.map(id => 
        id === currentUserId ? 'You' : (nameMap[id] || 'Unknown')
      );
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
    // Determine if this task requires multiple people
    const isMultipleAssignees = Array.isArray(taskData.assigned_to) && taskData.assigned_to.length > 1;
    
    // Get due date from day of week if not provided
    const dueDate = taskData.due_date || getDateFromDayOfWeek(taskData.day_of_week);
    
    // If day_of_week is a full date (YYYY-MM-DD), extract the actual day of week
    let dayOfWeek = taskData.day_of_week;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayOfWeek)) {
      const dateObj = new Date(dayOfWeek);
      const dayOfWeekNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      dayOfWeek = dayOfWeekNames[dateObj.getDay()];
    }
    
    // For multiple assignees, we'll set assigned_to to null
    // For single assignee, we extract it from the array or use it directly
    let singleAssignee = null;
    if (!isMultipleAssignees) {
      if (Array.isArray(taskData.assigned_to) && taskData.assigned_to.length === 1) {
        singleAssignee = taskData.assigned_to[0];
      } else if (typeof taskData.assigned_to === 'string') {
        singleAssignee = taskData.assigned_to;
      } else {
        singleAssignee = userId; // Default to creator if no valid assignee
      }
    }
    
    // Create the task with correct assigned_to value (null for multiple, UUID for single)
    const newTask = {
      home_id: homeId,
      created_by: userId,
      title: taskData.title,
      description: taskData.description || '',
      category: taskData.category,
      icon: taskData.icon,
      status: 'pending' as TaskStatus,
      due_date: dueDate,
      rotation_day: dayOfWeek,
      assigned_to: singleAssignee, // Now properly set to null or a single UUID string
      requires_multiple_people: isMultipleAssignees,
      difficulty: taskData.difficulty,
      estimated_minutes: taskData.estimated_minutes,
      rotation_enabled: taskData.rotation_enabled,
      repeat_frequency: taskData.repeat_frequency,
      time_slot: taskData.time_slot || 'morning',
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
    
    // If task requires multiple people, add entries to task_assignees
    if (isMultipleAssignees && Array.isArray(taskData.assigned_to)) {
      const assignees = taskData.assigned_to.map((memberId, index) => ({
        task_id: task.id,
        user_id: memberId,
        assignment_order: index + 1
      }));
      
      const { error: assigneeError } = await supabase
        .from('task_assignees')
        .insert(assignees);
      
      if (assigneeError) {
        console.error('Error adding task assignees:', assigneeError);
      }
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
    if (!isMultipleAssignees && taskData.assigned_to && taskData.assigned_to !== userId) {
      await createUserNotification(
        taskData.assigned_to as string,
        homeId,
        'New Task Assigned',
        `${userName} assigned you a task: ${taskData.title}`,
        'info',
        'tasks',
        task.id
      );
    } else if (isMultipleAssignees && Array.isArray(taskData.assigned_to)) {
      // Notify each assignee except the creator
      for (const assigneeId of taskData.assigned_to) {
        if (assigneeId !== userId) {
          await createUserNotification(
            assigneeId,
            homeId,
            'New Task Assigned',
            `${userName} assigned you to a group task: ${taskData.title}`,
            'info',
            'tasks',
            task.id
          );
        }
      }
    }
    
    // Return the created task with enhanced info
    const enhancedTasks = await enhanceTasksWithNames([task]);
    return enhancedTasks[0] || task;
    
  } catch (error) {
    console.error('Unexpected error in createTask:', error);
    return null;
  }
};

// ... rest of the functions remain the same
