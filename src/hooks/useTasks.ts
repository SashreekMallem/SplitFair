import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import * as taskService from '../services/api/taskService';
import { fetchUserHomeMembership } from '../services/api/homeService';
import { 
  Task, 
  TaskStatus, 
  TaskSwapRequest, 
  CreateTaskParams 
} from '../services/api/taskService';
import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const useTasks = (initialHomeId?: string) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [homeId, setHomeId] = useState<string | undefined>(initialHomeId);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [swapRequests, setSwapRequests] = useState<TaskSwapRequest[]>([]);
  const [swapRequestsLoading, setSwapRequestsLoading] = useState<boolean>(false);
  
  // References to realtime subscriptions
  const tasksSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const historySubscriptionRef = useRef<RealtimeChannel | null>(null);
  const swapRequestsSubscriptionRef = useRef<RealtimeChannel | null>(null);
  
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
  
  // Fetch all tasks for a home
  const fetchTasks = useCallback(async (
    targetHomeId?: string, 
    status?: TaskStatus,
    assignedTo?: string
  ) => {
    const homeIdToUse = targetHomeId || homeId;
    
    if (!homeIdToUse) {
      const defaultHomeId = await fetchUserDefaultHome();
      
      if (!defaultHomeId) {
        setTasks([]);
        setLoading(false);
        return null;
      }
    }
    
    const effectiveHomeId = targetHomeId || homeId || await fetchUserDefaultHome();
    
    if (!effectiveHomeId) {
      setTasks([]);
      setLoading(false);
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const tasksData = await taskService.fetchTasks(
        effectiveHomeId, 
        status,
        assignedTo
      );
      
      setTasks(tasksData);
      return tasksData;
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks');
      return null;
    } finally {
      setLoading(false);
    }
  }, [homeId, fetchUserDefaultHome]);
  
  // Fetch swap requests
  const fetchSwapRequests = useCallback(async (status?: 'pending' | 'accepted' | 'rejected') => {
    if (!user?.id) {
      setSwapRequests([]);
      return null;
    }
    
    try {
      setSwapRequestsLoading(true);
      
      const requests = await taskService.fetchSwapRequests(user.id, status);
      setSwapRequests(requests);
      
      return requests;
    } catch (err: any) {
      console.error('Error fetching swap requests:', err);
      return null;
    } finally {
      setSwapRequestsLoading(false);
    }
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!homeId || !user?.id) {
      return;
    }

    // Clean up any existing subscriptions
    if (tasksSubscriptionRef.current) {
      tasksSubscriptionRef.current.unsubscribe();
      tasksSubscriptionRef.current = null;
    }
    
    if (historySubscriptionRef.current) {
      historySubscriptionRef.current.unsubscribe();
      historySubscriptionRef.current = null;
    }
    
    if (swapRequestsSubscriptionRef.current) {
      swapRequestsSubscriptionRef.current.unsubscribe();
      swapRequestsSubscriptionRef.current = null;
    }
    
    // Create subscription for tasks table
    const tasksSubscription = supabase
      .channel(`tasks-${Platform.OS}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `home_id=eq.${homeId}`
        },
        async (payload) => {
          console.log('Real-time tasks update:', payload);
          
          // Refresh tasks on change - this is a simpler approach than trying
          // to update the state in-place, which can get complex with nested data
          fetchTasks();
        }
      )
      .subscribe();
    
    // Create subscription for task_history table
    const historySubscription = supabase
      .channel(`task-history-${Platform.OS}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_history'
        },
        async (payload) => {
          console.log('Real-time task history update:', payload);
          
          // Get the associated task
          const taskId = payload.new.task_id;
          if (taskId) {
            // Refresh tasks on change
            fetchTasks();
          }
        }
      )
      .subscribe();
      
    // Create subscription for swap requests
    const swapRequestsSubscription = supabase
      .channel(`task-swap-requests-${Platform.OS}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_swap_requests'
        },
        async (payload) => {
          console.log('Real-time swap request update:', payload);
          
          if (
            (payload.new && (payload.new.requested_by === user.id || payload.new.requested_to === user.id)) ||
            (payload.old && (payload.old.requested_by === user.id || payload.old.requested_to === user.id))
          ) {
            // Refresh swap requests if they involve the current user
            fetchSwapRequests();
          }
        }
      )
      .subscribe();
    
    // Store subscription references
    tasksSubscriptionRef.current = tasksSubscription;
    historySubscriptionRef.current = historySubscription;
    swapRequestsSubscriptionRef.current = swapRequestsSubscription;
    
    // Clean up on unmount or when homeId changes
    return () => {
      if (tasksSubscriptionRef.current) {
        tasksSubscriptionRef.current.unsubscribe();
        tasksSubscriptionRef.current = null;
      }
      
      if (historySubscriptionRef.current) {
        historySubscriptionRef.current.unsubscribe();
        historySubscriptionRef.current = null;
      }
      
      if (swapRequestsSubscriptionRef.current) {
        swapRequestsSubscriptionRef.current.unsubscribe();
        swapRequestsSubscriptionRef.current = null;
      }
    };
  }, [homeId, user, fetchTasks, fetchSwapRequests]);
  
  // Create a new task
  const createTask = useCallback(async (taskData: CreateTaskParams) => {
    if (!user) {
      showNotification('Error', 'You must be logged in to create tasks', 'error');
      return null;
    }

    let targetHomeId = homeId;
    if (!targetHomeId) {
      try {
        const membership = await fetchUserHomeMembership(user.id);
        if (membership && membership.home_id) {
          targetHomeId = membership.home_id;
        }
      } catch (error) {
        console.error('Error fetching home membership:', error);
      }
    }

    if (!targetHomeId) {
      showNotification('Error', 'No home ID available', 'error');
      return null;
    }

    try {
      // Handle multiple assignees correctly
      const task = await taskService.createTask(
        targetHomeId,
        user.id,
        // Make sure the assigned_to array is passed properly
        taskData
      );

      if (task) {
        // Update the local tasks state with the new task
        setTasks((prevTasks) => [task, ...prevTasks]);
        showNotification('Success', 'Task created successfully', 'success');
        return task;
      }
      
      return null;
    } catch (error) {
      console.error('Error in createTask:', error);
      showNotification('Error', 'Failed to create task', 'error');
      return null;
    }
  }, [user, homeId, showNotification]);
  
  // Complete a task
  const completeTask = useCallback(async (
    taskId: string,
    completionDate?: string
  ) => {
    if (!user) {
      return false;
    }
    
    try {
      const success = await taskService.completeTask(
        taskId, 
        user.id,
        completionDate
      );
      
      if (success) {
        // Update the task status in the local state
        setTasks(prev => prev.map(task => {
          if (task.id === taskId) {
            return {
              ...task,
              status: 'completed',
            };
          }
          return task;
        }));
        
        showNotification('Success', 'Task completed!', 'success');
      }
      
      return success;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to complete task', 'error');
      return false;
    }
  }, [user, showNotification]);
  
  // Request a task swap
  const requestSwap = useCallback(async (
    taskId: string,
    requestedToUserId: string,
    originalDate: string,
    proposedDate: string,
    message?: string
  ) => {
    if (!user) {
      return null;
    }
    
    try {
      const swapRequest = await taskService.requestTaskSwap(
        taskId,
        user.id,
        requestedToUserId,
        originalDate,
        proposedDate,
        message
      );
      
      if (swapRequest) {
        // Refresh the swap requests
        fetchSwapRequests();
        showNotification('Success', 'Swap request sent', 'success');
      }
      
      return swapRequest;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to send swap request', 'error');
      return null;
    }
  }, [user, showNotification, fetchSwapRequests]);
  
  // Respond to a swap request
  const respondToSwap = useCallback(async (
    swapRequestId: string,
    accept: boolean
  ) => {
    try {
      const success = await taskService.respondToSwapRequest(swapRequestId, accept);
      
      if (success) {
        // Update the swap request status in local state
        setSwapRequests(prev => prev.map(req => {
          if (req.id === swapRequestId) {
            return {
              ...req,
              status: accept ? 'accepted' : 'rejected'
            };
          }
          return req;
        }));
        
        showNotification(
          accept ? 'Swap Accepted' : 'Swap Declined',
          accept ? 'Task swap request accepted' : 'Task swap request declined',
          accept ? 'success' : 'info'
        );
      }
      
      return success;
    } catch (err: any) {
      showNotification('Error', err.message || 'Failed to respond to swap request', 'error');
      return false;
    }
  }, [showNotification]);
  
  // Load tasks on mount and when homeId changes
  useEffect(() => {
    if (homeId) {
      fetchTasks();
      fetchSwapRequests('pending');
    } else {
      fetchUserDefaultHome().then(defaultHomeId => {
        if (defaultHomeId) {
          fetchTasks(defaultHomeId);
          fetchSwapRequests('pending');
        } else {
          setTasks([]);
          setSwapRequests([]);
        }
      });
    }
  }, [homeId, fetchTasks, fetchSwapRequests, fetchUserDefaultHome]);
  
  return {
    tasks,
    loading,
    error,
    swapRequests,
    swapRequestsLoading,
    homeId,
    setHomeId,
    fetchTasks,
    refreshTasks: fetchTasks, // Alias for consistency
    fetchSwapRequests,
    createTask,
    completeTask,
    requestSwap,
    respondToSwap,
  };
};

export default useTasks;
