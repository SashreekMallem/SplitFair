import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';
import HomeIsland, { IslandMode } from '../../components/HomeIsland';
import useHouseRules from '../../hooks/useHouseRules';
import useHomeMembers from '../../hooks/useHomeMembers';
import { HouseRule, RuleComment} from '../../services/api/houseRulesService';
import { createStableKey } from '../../utils/keyHelper';
import useTasks from '../../hooks/useTasks';
import UserAvatar from '../../components/common/UserAvatar';
import { 
  isUserAvailableAt, 
  getUserAvailability, 
  getTeamAvailability, 
  UserAvailability 
} from '../../services/api/availabilityService';
import { fetchUserHomeMembership } from '../../services/api/homeService';

const RULE_CATEGORIES = [
  { id: 'Noise', color: '#9F71ED', icon: 'volume-high-outline' },
  { id: 'Cleanliness', color: '#2EAF89', icon: 'sparkles-outline' },
  { id: 'Guests', color: '#FF9855', icon: 'people-outline' },
  { id: 'Shopping', color: '#546DE5', icon: 'cart-outline' },
  { id: 'Utilities', color: '#EB5982', icon: 'flash-outline' },
  { id: 'Other', color: '#26C6DA', icon: 'ellipsis-horizontal-outline' },
];

const CHORE_CATEGORIES = [
  { id: 'cleaning', name: 'Cleaning', icon: 'sparkles-outline', color: '#2EAF89' },
  { id: 'cooking', name: 'Cooking', icon: 'restaurant-outline', color: '#FF9855' },
  { id: 'dishes', name: 'Dishes', icon: 'water-outline', color: '#26C6DA' },
  { id: 'shopping', name: 'Shopping', icon: 'cart-outline', color: '#546DE5' },
  { id: 'laundry', name: 'Laundry', icon: 'shirt-outline', color: '#9B59B6' },
  { id: 'trash', name: 'Trash', icon: 'trash-outline', color: '#EB5982' },
  { id: 'pets', name: 'Pets', icon: 'paw-outline', color: '#F7B731' },
  { id: 'maintenance', name: 'Maintenance', icon: 'hammer-outline', color: '#8E44AD' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#7F8C8D' },
];

const EVALUATION_OPTIONS = [
  { value: 'completed', label: 'Completed Well', icon: 'checkmark-circle', color: '#2EAF89' },
  { value: 'acceptable', label: 'Acceptable', icon: 'thumbs-up', color: '#546DE5' },
  { value: 'poor', label: 'Poorly Done', icon: 'alert-circle', color: '#F7B731', penalty: 1 },
  { value: 'incomplete', label: 'Left Incomplete', icon: 'remove-circle', color: '#FF9855', penalty: 2 },
  { value: 'not_done', label: 'Not Done At All', icon: 'close-circle', color: '#EB4D4B', penalty: 3 },
];

const getDaysOfWeek = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const days = [];
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - dayOfWeek);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push({
      name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
      date: date,
      dateStr: date.toISOString().split('T')[0],
      isToday: date.toDateString() === today.toDateString(),
    });
  }

  return days;
};

const TasksScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigation = useNavigation();

  const [islandMode, setIslandMode] = useState<IslandMode>('tasks');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'rules'>('tasks');
  const [taskFilter, setTaskFilter] = useState<'mine' | 'all' | 'upcoming'>('mine');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<string>('');
  const [ruleFilter, setRuleFilter] = useState<string | null>(null);
  const [showEditRuleModal, setShowEditRuleModal] = useState<boolean>(false);
  const [ruleToEdit, setRuleToEdit] = useState<HouseRule | null>(null);
  const [editedRule, setEditedRule] = useState({
    title: '',
    description: '',
    category: 'Other',
  });

  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);
  const [daysOfWeek, setDaysOfWeek] = useState(getDaysOfWeek());

  const homeId = user?.user_metadata?.home_id || '';

  const [membersAvailability, setMembersAvailability] = useState<Record<string, UserAvailability>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  useEffect(() => {
    // Intentionally empty after removing debug code
  }, [homeId, user]);

  const {
    rules: houseRules,
    loading: rulesLoading,
    error: rulesError,
    fetchRules: refreshRules,
    createRule,
    updateRule,
    toggleAgreement,
    addComment,
    deleteRule,
  } = useHouseRules(homeId);

  const { members, loading: membersLoading, error: membersError } = useHomeMembers(homeId);

  useEffect(() => {
    // Intentionally empty after removing debug code
  }, [members, membersError]);

  const {
    tasks,
    loading: tasksLoading,
    swapRequests,
    fetchTasks: refreshTasks,
    createTask,
    completeTask,
    requestSwap,
    respondToSwap,
  } = useTasks(homeId);

  const [showNewTaskModal, setShowNewTaskModal] = useState<boolean>(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState<boolean>(false);
  const [showEvaluateTaskModal, setShowEvaluateTaskModal] = useState<boolean>(false);
  const [taskToEvaluate, setTaskToEvaluate] = useState<any | null>(null);
  const [evaluationRating, setEvaluationRating] = useState<string>('acceptable');
  const [evaluationNotes, setEvaluationNotes] = useState<string>('');
  const [evaluationPhoto, setEvaluationPhoto] = useState<string | null>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    day_of_week: 'mon',
    time_slot: 'morning',
    assigned_to: [] as string[],
    requires_multiple_people: false, // Flag to indicate multiple people requirement
    rotationEnabled: false,
    rotationMembers: [] as string[],
    rotationFrequency: 'weekly',
  });

  const [newRule, setNewRule] = useState({
    title: '',
    description: '',
    category: 'Other',
  });

  const [showSwapRequestModal, setShowSwapRequestModal] = useState<boolean>(false);
  const [taskToSwap, setTaskToSwap] = useState<any | null>(null);
  const [swapRequest, setSwapRequest] = useState({
    requestedTo: '',
    originalDate: '',
    message: '',
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerAnimation = useRef(new Animated.Value(0)).current;
  const contentAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(contentAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const calculatePenaltyPoints = () => {
    if (!user || !tasks) return 0;

    let penaltyPoints = 0;
    tasks.forEach((task) => {
      if (task.completion_history) {
        penaltyPoints += task.completion_history.filter(
          (h) => h.status === 'missed' && task.assigned_to === user.id
        ).length;
      }
    });

    return penaltyPoints;
  };

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([refreshRules(), refreshTasks()]);
      showNotification('Updated', 'Your tasks and rules have been refreshed', 'success');
    } catch (error) {
      showNotification('Error', 'Failed to refresh some data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleIslandAction = () => {
    if (islandMode === 'tasks') {
      setShowNewTaskModal(true);
    }
  };

  const fetchMembersAvailability = useCallback(async () => {
    if (!members || members.length === 0) return;

    setLoadingAvailability(true);
    try {
      const userIds = members.map(member => member.user_id);
      const availability = await getTeamAvailability(userIds);
      console.log('Fetched availability data:', availability);
      setMembersAvailability(availability);
    } catch (error) {
      console.error('Error fetching members availability:', error);
    } finally {
      setLoadingAvailability(false);
    }
  }, [members]);

  // Add the missing renderWeeklyCalendar function
  const renderWeeklyCalendar = () => {
    return (
      <View style={styles.weeklyCalendarContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarList}
        >
          {daysOfWeek.map((day) => {
            const isSelected = selectedDay === day.dateStr;
            
            // Count tasks for this day
            const dayTasks = tasks.filter(task => {
              const taskDate = task.due_date ? task.due_date.split('T')[0] : '';
              return taskDate === day.dateStr;
            });
            
            // Count my tasks for this day
            const myDayTasks = dayTasks.filter(task => {
              if (Array.isArray(task.assigned_to)) {
                return task.assigned_to.includes(user?.id);
              } else if (task.assigned_to) {
                return task.assigned_to === user?.id;
              } else {
                // Include tasks created by the user with null assigned_to
                return task.created_by === user?.id;
              }
            });
            
            return (
              <TouchableOpacity
                key={day.dateStr}
                onPress={() => setSelectedDay(day.dateStr)}
                style={[
                  styles.dayCard,
                  { backgroundColor: theme.colors.card },
                  day.isToday && styles.todayCard,
                  isSelected && styles.selectedDayCard,
                ]}
              >
                <Text 
                  style={[
                    styles.dayName, 
                    isSelected && { color: theme.colors.primary },
                  ]}
                >
                  {day.name}
                </Text>
                <Text 
                  style={[
                    styles.dayDate, 
                    isSelected && { color: theme.colors.primary, fontWeight: '800' },
                  ]}
                >
                  {day.date.getDate()}
                </Text>
                
                {myDayTasks.length > 0 && (
                  <View style={styles.taskCountBadge}>
                    <Text style={styles.taskCountText}>{myDayTasks.length}</Text>
                  </View>
                )}
                
                {myDayTasks.length === 0 && dayTasks.length > 0 && (
                  <View style={styles.allTasksCountBadge}>
                    <Text style={styles.taskCountText}>{dayTasks.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const isMemberAvailable = (userId: string, dayOfWeek: string, timeSlot: string): boolean => {
    const availability = membersAvailability[userId];
    return isUserAvailableAt(availability, dayOfWeek, timeSlot);
  };

  useEffect(() => {
    if (showNewTaskModal && members && members.length > 0) {
      fetchMembersAvailability();
    }
  }, [showNewTaskModal, members, fetchMembersAvailability]);

  // Add this helper function to handle both day name strings and full date strings
  const getDateFromDayOfWeek = (dayInput: string): string => {
    console.log("getDateFromDayOfWeek called with:", dayInput);
    
    // Check if the input is already a full date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayInput)) {
      console.log("Input is already a date string, returning as is:", dayInput);
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
    const result = targetDate.toISOString().split('T')[0];
    console.log("Calculated date:", result);
    return result;
  };

  const handleCreateTask = async () => {
    console.log("handleCreateTask started", { 
      title: newTask.title, 
      description: newTask.description,
      day_of_week: newTask.day_of_week,
      time_slot: newTask.time_slot,
      assigned_to: newTask.assigned_to,
      requires_multiple_people: newTask.assigned_to.length > 1,
      rotationEnabled: newTask.rotationEnabled
    });
    
    if (!newTask.title) {
      console.log("Error: Missing task title");
      showNotification('Error', 'Please enter a task title', 'error');
      return;
    }

    if (newTask.assigned_to.length === 0) {
      console.log("Error: No assignees selected");
      showNotification('Error', 'Please assign the task to at least one person', 'error');
      return;
    }

    const defaultCategory = 'other';
    const defaultIcon = 'checkmark-circle-outline';

    console.log("Getting date from day of week:", newTask.day_of_week);
    const dueDate = getDateFromDayOfWeek(newTask.day_of_week);
    console.log("Generated due date:", dueDate);

    try {
      // Extract actual day of week from date for storage
      const dateObj = new Date(dueDate);
      const dayOfWeekNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const actualDayOfWeek = dayOfWeekNames[dateObj.getDay()];
      console.log("Actual day of week:", actualDayOfWeek);
      
      // Instead of creating separate tasks for each assignee, create one task with multiple assignees
      const requiresMultiplePeople = newTask.assigned_to.length > 1;
      
      console.log(`Creating task with ${requiresMultiplePeople ? 'multiple required assignees' : 'single assignee'}`);
      
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        category: defaultCategory,
        icon: defaultIcon,
        due_date: dueDate,
        day_of_week: actualDayOfWeek,
        time_slot: newTask.time_slot,
        assigned_to: newTask.assigned_to, // Now sending the whole array of assignees
        requires_multiple_people: requiresMultiplePeople, // New field to indicate multiple people requirement
        rotation_enabled: newTask.rotationEnabled,
        rotation_members: newTask.rotationMembers.length > 0 
          ? newTask.rotationMembers 
          : undefined,
        repeat_frequency: newTask.rotationEnabled ? newTask.rotationFrequency : undefined,
      };

      console.log("Creating task with data:", taskData);
      const result = await createTask(taskData);
      console.log("Task creation result:", result);

      setShowNewTaskModal(false);
      showNotification(
        'Success', 
        'Task created successfully', 
        'success'
      );
      
      console.log("Resetting task form data");
      setNewTask({
        title: '',
        description: '',
        day_of_week: 'mon',
        time_slot: 'morning',
        assigned_to: [],
        requires_multiple_people: false,
        rotationEnabled: false,
        rotationMembers: [],
        rotationFrequency: 'weekly',
      });

      console.log("Refreshing tasks list");
      refreshTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showNotification('Error', 'Failed to create task', 'error');
    }
  };

  const handleCreateRule = async () => {
    console.log("handleCreateRule started", { 
      title: newRule.title, 
      description: newRule.description,
      category: newRule.category
    });
    
    if (!newRule.title || !newRule.description) {
      showNotification('Error', 'Please fill in all required fields', 'error');
      return;
    }
    
    let targetHomeId = homeId;
    console.log("Initial homeId:", homeId);
    
    if (!targetHomeId && user?.id) {
      console.log("No home ID found, trying to fetch user home membership", user.id);
      try {
        // Check if fetchUserHomeMembership is defined
        if (typeof fetchUserHomeMembership !== 'function') {
          console.error("fetchUserHomeMembership function is not defined!");
          showNotification('Error', 'Internal function error: fetchUserHomeMembership not found', 'error');
          return;
        }
        
        const membership = await fetchUserHomeMembership(user.id);
        console.log("Fetched membership:", membership);
        
        if (membership && membership.home_id) {
          targetHomeId = membership.home_id;
          console.log("Found home ID from membership:", targetHomeId);
        } else {
          console.log("No home ID in membership data", membership);
          showNotification('Error', 'You need to be a member of a home to create rules', 'error');
          return;
        }
      } catch (error) {
        console.error("Error fetching user home membership:", error);
        showNotification('Error', 'Failed to verify home membership', 'error');
        return;
      }
    }
    
    if (!targetHomeId) {
      console.error("No target home ID available after all checks");
      showNotification('Error', 'Home ID is missing. Cannot create rule.', 'error');
      return;
    }
    
    console.log("Attempting to create rule with home ID:", targetHomeId);
    try {
      console.log("Rule data to be sent:", {
        title: newRule.title,
        description: newRule.description,
        category: newRule.category
      });
      
      const result = await createRule(
        {
          title: newRule.title,
          description: newRule.description,
          category: newRule.category
        },
        targetHomeId
      );
      
      console.log("Create rule result:", result);
      
      if (result) {
        setShowNewRuleModal(false);
        setNewRule({
          title: '',
          description: '',
          category: 'Other'
        });
      }
    } catch (error: any) {
      console.error("Error creating rule:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showNotification('Error', `Failed to create rule: ${error.message}`, 'error');
    }
  };

  const handleRuleAgreement = async (ruleId: string) => {
    try {
      await toggleAgreement(ruleId);
    } catch (error) {
      showNotification('Error', 'Failed to update agreement', 'error');
    }
  };

  const handleAddComment = async (ruleId: string) => {
    if (!newComment.trim()) return;

    try {
      await addComment(ruleId, newComment.trim());
      setNewComment('');
    } catch (error) {
      showNotification('Error', 'Failed to add comment', 'error');
    }
  };

  const handleEditRule = async () => {
    if (!ruleToEdit || !ruleToEdit.id || !editedRule) {
      showNotification('Error', 'Invalid rule data', 'error');
      return;
    }

    try {
      const result = await updateRule(ruleToEdit.id, {
        title: editedRule.title,
        description: editedRule.description,
        category: editedRule.category,
      });

      if (result) {
        setShowEditRuleModal(false);
        setRuleToEdit(null);
        showNotification('Success', 'Rule updated successfully', 'success');
      }
    } catch (error) {
      showNotification('Error', 'Failed to update rule', 'error');
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    Alert.alert(
      'Delete Rule',
      'Are you sure you want to delete this rule? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteRule(ruleId);
            if (success) {
              showNotification('Success', 'Rule deleted successfully', 'success');
            } else {
              showNotification('Error', 'Failed to delete rule', 'error');
            }
          },
        },
      ]
    );
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask(taskId);
    } catch (error) {
      showNotification('Error', 'Failed to complete task', 'error');
    }
  };

  const handleEvaluateTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setTaskToEvaluate(task);
      setEvaluationRating('acceptable');
      setEvaluationNotes('');
      setEvaluationPhoto(null);
      setShowEvaluateTaskModal(true);
    }
  };

  const submitTaskEvaluation = async () => {
    if (!taskToEvaluate) return;

    try {
      const evalOption = EVALUATION_OPTIONS.find((opt) => opt.value === evaluationRating);
      const penaltyPoints = evalOption?.penalty || 0;

      if (penaltyPoints > 0) {
        const assignedUserId = taskToEvaluate.assigned_to;
        await addPenaltyPoints(assignedUserId, penaltyPoints, taskToEvaluate.id, evaluationRating, evaluationNotes);

        showNotification(
          'Task Evaluation Submitted',
          `${penaltyPoints} penalty point${penaltyPoints !== 1 ? 's' : ''} assigned`,
          'warning'
        );
      } else {
        showNotification('Task Evaluation Submitted', 'No penalties assigned', 'success');
      }

      setShowEvaluateTaskModal(false);
      setTaskToEvaluate(null);
      refreshTasks();
    } catch (error) {
      showNotification('Error', 'Failed to submit evaluation', 'error');
    }
  };

  const handleRequestSwap = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setTaskToSwap(task);
      setSwapRequest({
        requestedTo: '',
        originalDate: task.due_date || '',
        message: '',
      });
      setShowSwapRequestModal(true);
    }
  };

  const submitSwapRequest = async () => {
    if (!taskToSwap || !swapRequest.requestedTo) {
      showNotification('Error', 'Please select a person to swap with', 'error');
      return;
    }

    try {
      // Using the original due date for both dates
      const originalDate = taskToSwap.due_date || '';
      await requestSwap(
        taskToSwap.id,
        swapRequest.requestedTo,
        originalDate,
        originalDate, // Using same date since we removed date selection
        swapRequest.message
      );

      setShowSwapRequestModal(false);
      setTaskToSwap(null);
      showNotification('Success', 'Swap request sent', 'success');
    } catch (error) {
      showNotification('Error', 'Failed to submit swap request', 'error');
    }
  };

  const handleSwapResponse = async (swapRequestId: string, accept: boolean) => {
    try {
      await respondToSwap(swapRequestId, accept);
      
      // Show notification
      showNotification(
        accept ? 'Swap Accepted' : 'Swap Declined', 
        accept ? 'Task has been reassigned to you' : 'Swap request was declined',
        accept ? 'success' : 'info'
      );
      
      // Refresh tasks immediately to update the UI
      refreshTasks();
    } catch (error) {
      showNotification('Error', 'Failed to respond to swap request', 'error');
    }
  };

  useEffect(() => {
    if (tasks && tasks.length > 0) {
      console.log("Tasks received from API:", tasks.length);
      console.log("First task format sample:", JSON.stringify(tasks[0], null, 2));
      console.log("Selected day:", selectedDay);
    } else {
      console.log("No tasks received from API or tasks array is empty");
    }
  }, [tasks, selectedDay]);

  // Add a thorough debugging useEffect right before getFilteredTasks
  useEffect(() => {
    console.log("========== TASK DATA INSPECTION ==========");
    console.log(`Tasks array length: ${tasks?.length || 0}`);
    
    if (tasks && tasks.length > 0) {
      console.log("First task sample:", JSON.stringify({
        id: tasks[0].id,
        title: tasks[0].title,
        assigned_to: tasks[0].assigned_to,
        due_date: tasks[0].due_date,
        status: tasks[0].status
      }, null, 2));
      
      // Check assignment format patterns across all tasks
      const assignmentFormats = tasks.map(task => {
        return {
          id: task.id.substring(0, 6),
          isArray: Array.isArray(task.assigned_to),
          value: task.assigned_to
        };
      });
      console.log("Assignment formats:", JSON.stringify(assignmentFormats, null, 2));
      
      // Count tasks for current selected day
      const tasksForSelectedDay = tasks.filter(task => {
        const taskDate = task.due_date ? task.due_date.split('T')[0] : '';
        return taskDate === selectedDay;
      });
      console.log(`Tasks matching selected day (${selectedDay}): ${tasksForSelectedDay.length}`);
      
      // Count tasks assigned to current user
      const myTasks = tasks.filter(task => {
        if (Array.isArray(task.assigned_to)) {
          return task.assigned_to.includes(user?.id);
        } else {
          return task.assigned_to === user?.id;
        }
      });
      console.log(`Tasks assigned to current user: ${myTasks.length}`);
    } else {
      console.log("No tasks available");
    }
    console.log("========================================");
  }, [tasks, selectedDay, user?.id]);

  const getFilteredTasks = () => {
    console.log("--------- FILTERING TASKS ---------");
    console.log(`Total tasks before filtering: ${tasks.length}`);
    console.log(`Current filter mode: ${taskFilter}`);
    console.log(`Current user ID: ${user?.id}`);
    
    // Create detailed debugging output
    const filtered = tasks.filter((task) => {
      console.log(`Task ID: ${task.id}, Title: ${task.title}, Due date: ${task.due_date}, assigned_to: ${JSON.stringify(task.assigned_to)}, requires_multiple: ${task.requires_multiple_people}, created_by: ${task.created_by}`);
      
      // Remove date filtering - we show all tasks regardless of date
      
      if (taskFilter === 'mine') {
        // Check all possible ways a task can be assigned to the current user
        
        // Case 1: Direct array assignment
        if (Array.isArray(task.assigned_to) && task.assigned_to.includes(user?.id)) {
          console.log(`  user ${user?.id} is in the assigned_to array`);
          return true;
        }
        
        // Case 2: Single assignee
        if (task.assigned_to === user?.id) {
          console.log(`  user ${user?.id} is the single assignee`);
          return true;
        }
        
        // Case 3: Using task_assignees table for multi-person tasks
        if (task.task_assignees && Array.isArray(task.task_assignees)) {
          const isInTaskAssignees = task.task_assignees.some(
            (assignee) => assignee.user_id === user?.id
          );
          
          if (isInTaskAssignees) {
            console.log(`  user ${user?.id} is in the task_assignees table`);
            return true;
          }
        }
        
        // Case 4: For backwards compatibility - creator of a multi-person task
        if (task.requires_multiple_people && task.created_by === user?.id && !task.assigned_to) {
          console.log(`  user ${user?.id} is the creator of this multi-person task`);
          return true;
        }
        
        console.log(`  user ${user?.id} is not associated with this task`);
        return false;
      }
      
      if (taskFilter === 'upcoming') {
        const dueDate = new Date(task.due_date || '');
        const today = new Date();
        const inNextThreeDays =
          dueDate >= today &&
          dueDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        console.log(`  is task upcoming (next 3 days)? ${inNextThreeDays}`);
        return inNextThreeDays;
      }
      
      console.log(`  task included in 'all' filter`);
      return true;
    });
    
    console.log(`Tasks after filtering: ${filtered.length}`);
    if (filtered.length > 0) {
      console.log(`First filtered task: ${filtered[0].title}`);
    } else {
      console.log(`No tasks passed the filter criteria`);
    }
    console.log("----------------------------------");
    return filtered;
  };

  // Add the missing function here
  const getPendingSwapRequests = () => {
    console.log("--------- GETTING PENDING SWAP REQUESTS ---------");
    console.log(`Total swap requests: ${swapRequests.length}`);
    
    const pendingRequests = swapRequests.filter(
      (req) => req.requested_to === user?.id && req.status === 'pending'
    );
    
    console.log(`Pending swap requests for current user: ${pendingRequests.length}`);
    if (pendingRequests.length > 0) {
      console.log("Pending swap requests:", pendingRequests.map(r => r.id).join(', '));
    }
    
    return pendingRequests;
  };

  // Update renderTasksTab to include additional logging
  const renderTasksTab = () => {
    const filteredTasks = getFilteredTasks();
    console.log(`renderTasksTab: ${filteredTasks.length} tasks after filtering`);
    
    // Log more details about the filtered tasks
    if (filteredTasks.length > 0) {
      console.log("Filtered task titles:", filteredTasks.map(t => t.title).join(", "));
    }
    
    const pendingSwapRequests = getPendingSwapRequests();

    return (
      <View style={styles.tabContent}>
        {/* Remove renderWeeklyCalendar() call here to remove date selector */}

        <View style={styles.selectedDayHeader}>
          <Text style={[styles.selectedDayText, { color: theme.colors.text }]}>
            All Tasks
          </Text>
          <TouchableOpacity
            style={[styles.addTaskButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setShowNewTaskModal(true);
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addTaskText}>Add Task</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              taskFilter === 'mine' && styles.activeFilterButton,
              { backgroundColor: taskFilter === 'mine' ? theme.colors.primary : 'rgba(150, 150, 150, 0.1)' },
            ]}
            onPress={() => setTaskFilter('mine')}
          >
            <Text style={[styles.filterText, { color: taskFilter === 'mine' ? '#fff' : theme.colors.text }]}>
              My Tasks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              taskFilter === 'all' && styles.activeFilterButton,
              { backgroundColor: taskFilter === 'all' ? theme.colors.primary : 'rgba(150, 150, 150, 0.1)' },
            ]}
            onPress={() => setTaskFilter('all')}
          >
            <Text style={[styles.filterText, { color: taskFilter === 'all' ? '#fff' : theme.colors.text }]}>
              All Tasks
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.taskListContainer}>
          {tasksLoading ? (
            <Text style={styles.loadingText}>Loading tasks...</Text>
          ) : filteredTasks.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="checkmark-circle-outline" size={60} color="rgba(150, 150, 150, 0.5)" />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No tasks to display</Text>
              <Text style={styles.emptyStateSubtext}>
                {taskFilter === 'mine'
                  ? "You don't have any tasks assigned"
                  : "No tasks have been created yet"}
              </Text>
            </View>
          ) : (
            filteredTasks.map((task) => renderTaskItem(task))
          )}
        </View>

        {pendingSwapRequests.length > 0 && (
          <View style={styles.swapRequestsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Swap Requests</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {pendingSwapRequests.map((request) => renderSwapRequestItem(request))}
          </View>
        )}
      </View>
    );
  };

  const renderTaskItem = (task: any) => {
    // Check if task is assigned to current user, handling various assignment formats
    let isMyTask = false;
    
    // Check all possible ways a task can be assigned to the current user
    if (Array.isArray(task.assigned_to) && task.assigned_to.includes(user?.id)) {
      isMyTask = true;
    } else if (task.assigned_to === user?.id) {
      isMyTask = true;
    } else if (task.task_assignees && Array.isArray(task.task_assignees) && 
               task.task_assignees.some((assignee: any) => assignee.user_id === user?.id)) {
      isMyTask = true;
    } else if (task.requires_multiple_people && task.created_by === user?.id && !task.assigned_to) {
      isMyTask = true;
    }
    
    console.log(`Task "${task.title}" isMyTask: ${isMyTask}, assigned_to: ${JSON.stringify(task.assigned_to)}, requires_multiple: ${task.requires_multiple_people}, created_by: ${task.created_by}`);
    
    const isPending = task.status === 'pending';
    const isCompleted = task.status === 'completed';

    // Get all assignee names if multiple
    let assignedNames = '';
    if (Array.isArray(task.assigned_to) && task.assigned_to.length > 1) {
      assignedNames = task.assigned_to.map(id => {
        const member = members.find(m => m.user_id === id);
        return member ? (member.user_id === user?.id ? 'You' : member.full_name) : 'Unknown';
      }).join(', ');
    } else {
      const assigneeId = Array.isArray(task.assigned_to) ? task.assigned_to[0] : task.assigned_to;
      const assignedMember = members.find((m) => m.user_id === assigneeId);
      assignedNames = assignedMember ? (assigneeId === user?.id ? 'You' : assignedMember.full_name) : 'Unknown';
    }

    // If it's a multi-person task without assigned_to, show creator as assignee
    if (!task.assigned_to && task.requires_multiple_people && task.created_by) {
      const creatorMember = members.find((m) => m.user_id === task.created_by);
      assignedNames = creatorMember ? 
        (task.created_by === user?.id ? 'You - Group Task' : `${creatorMember.full_name} - Group Task`) : 
        'Group Task';
    }

    // If task has task_assignees, show relevant information
    if (task.task_assignees && task.task_assignees.length > 0) {
      assignedNames = task.task_assignees.map((assignee: any) => {
        const member = members.find(m => m.user_id === assignee.user_id);
        return member ? (member.user_id === user?.id ? 'You' : member.full_name) : 'Unknown';
      }).join(', ');
      
      if (task.task_assignees.length > 1) {
        assignedNames += ' - Group Task';
      }
    }

    const categoryInfo =
      CHORE_CATEGORIES.find((cat) => cat.id === task.category) ||
      CHORE_CATEGORIES[CHORE_CATEGORIES.length - 1];

    return (
      <View
        key={createStableKey(task.id, 'task')}
        style={[styles.taskCard, { backgroundColor: theme.colors.card }]}
      >
        <View style={styles.taskHeaderBar}>
          <View
            style={[
              styles.categoryColorIndicator,
              { backgroundColor: categoryInfo.color },
            ]}
          />
        </View>

        <View style={styles.taskHeader}>
          <View
            style={[
              styles.taskIconContainer,
              {
                backgroundColor: isCompleted
                  ? 'rgba(46, 175, 137, 0.1)'
                  : `${categoryInfo.color}20`,
              },
            ]}
          >
            <Ionicons
              name={task.icon || categoryInfo.icon}
              size={20}
              color={isCompleted ? '#2EAF89' : categoryInfo.color}
            />
          </View>

          <View style={styles.taskTitleContainer}>
            <Text
              style={[
                styles.taskTitle,
                isCompleted && styles.completedTaskTitle,
                { color: theme.colors.text },
              ]}
            >
              {task.title}
            </Text>
            {task.description && (
              <Text style={styles.taskDescription} numberOfLines={2}>
                {task.description}
              </Text>
            )}
          </View>

          <View style={styles.taskAssigneeContainer}>
            <UserAvatar
              name={assignedNames}
              size={32}
              isCurrentUser={isMyTask}
              showBorder
            />
            <Text
              style={[
                styles.assigneeName,
                isMyTask && styles.myTaskLabel,
                { color: isMyTask ? '#546DE5' : theme.colors.text },
              ]}
            >
              {assignedNames}
            </Text>
          </View>
        </View>

        {/* Display "Requires multiple people" badge if applicable */}
        {task.requires_multiple_people && (
          <View style={styles.multipleRequiredBadge}>
            <Ionicons name="people" size={14} color="#FF9855" />
            <Text style={styles.multipleRequiredText}>
              Requires {Array.isArray(task.assigned_to) ? task.assigned_to.length : 2} people
            </Text>
          </View>
        )}

        {task.penalty_points && task.penalty_points > 0 && (
          <PenaltyStatusBadge points={task.penalty_points} />
        )}

        <View style={styles.taskActions}>
          {isMyTask && isPending && (
            <>
              <TouchableOpacity
                style={[styles.taskActionButton, styles.completeButton]}
                onPress={() => handleCompleteTask(task.id)}
              >
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Complete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.taskActionButton, styles.swapButton]}
                onPress={() => handleRequestSwap(task.id)}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Swap</Text>
              </TouchableOpacity>
            </>
          )}

          {!isMyTask &&
            isCompleted &&
            task.completion_history &&
            task.completion_history.length > 0 &&
            !task.completion_history[0].rating && (
              <TouchableOpacity
                style={[styles.taskActionButton, styles.evaluateButton]}
                onPress={() => handleEvaluateTask(task.id)}
              >
                <Ionicons name="star-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Evaluate</Text>
              </TouchableOpacity>
            )}

          {isCompleted && task.completion_history && task.completion_history.length > 0 && (
            <View style={styles.completedStatusContainer}>
              <Ionicons name="checkmark-circle" size={18} color="#2EAF89" />
              <Text style={styles.completedStatusText}>
                Completed by {task.completion_history[0].completed_by_name || 'Unknown'}
              </Text>
            </View>
          )}
        </View>

        {task.rotation_enabled && task.rotation_members && (
          <View style={styles.rotationInfo}>
            <Ionicons name="repeat" size={14} color="#999" />
            <Text style={styles.rotationText}>
              Rotates {task.repeat_frequency || 'weekly'} between{' '}
              {task.rotation_members.map((m: any) => m.user_name || 'Unknown').join(', ')}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSwapRequestItem = (request: any) => {
    return (
      <View key={request.id} style={[styles.swapRequestCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.swapRequestInfo}>
          <Text style={[styles.swapRequestTitle, { color: theme.colors.text }]}>
            {request.requested_by_name} wants to swap "{request.task_title || 'a task'}"
          </Text>
          <Text style={styles.swapRequestDetails}>
            From {new Date(request.original_date).toLocaleDateString()} to{' '}
            {new Date(request.proposed_date).toLocaleDateString()}
          </Text>
          {request.message && (
            <View style={styles.swapRequestMessage}>
              <Text style={styles.swapRequestMessageText}>"{request.message}"</Text>
            </View>
          )}
        </View>

        <View style={styles.swapRequestActions}>
          <TouchableOpacity
            style={[styles.swapActionButton, styles.acceptButton]}
            onPress={() => handleSwapResponse(request.id, true)}
          >
            <Text style={styles.swapActionButtonText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.swapActionButton, styles.rejectButton]}
            onPress={() => handleSwapResponse(request.id, false)}
          >
            <Text style={styles.swapActionButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRulesTab = () => {
    const filteredRules = ruleFilter
      ? houseRules.filter((rule) => rule.category === ruleFilter)
      : houseRules;

    return (
      <View style={styles.tabContent}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ruleCategoriesContainer}
        >
          <TouchableOpacity
            style={[
              styles.categoryFilterButton,
              !ruleFilter && styles.activeCategoryFilter,
            ]}
            onPress={() => setRuleFilter(null)}
          >
            <Ionicons
              name="list"
              size={16}
              color={!ruleFilter ? '#fff' : isDarkMode ? '#999' : '#666'}
            />
            <Text
              style={[
                styles.categoryFilterText,
                { color: !ruleFilter ? '#fff' : isDarkMode ? '#999' : '#666' },
              ]}
            >
              All Rules
            </Text>
          </TouchableOpacity>
          {RULE_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryFilterButton,
                ruleFilter === category.id && styles.activeCategoryFilter,
                {
                  backgroundColor: ruleFilter === category.id
                    ? category.color
                    : 'rgba(150, 150, 150, 0.1)',
                },
              ]}
              onPress={() => setRuleFilter((prev) => (prev === category.id ? null : category.id))}
            >
              <Ionicons
                name={category.icon}
                size={16}
                color={ruleFilter === category.id ? '#fff' : category.color}
              />
              <Text
                style={[
                  styles.categoryFilterText,
                  { color: ruleFilter === category.id ? '#fff' : category.color },
                ]}
              >
                {category.id}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.rulesSummary}>
          <View style={[styles.ruleSummaryCard, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.ruleSummaryNumber}>
              {houseRules.length}
            </Text>
            <Text style={styles.ruleSummaryLabel}>
              Total Rules
            </Text>
          </View>
          <View style={[styles.ruleSummaryCard, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.ruleSummaryNumber}>
              {user && houseRules.filter(rule => rule.agreements?.some(a => a.user_id === user.id)).length}
            </Text>
            <Text style={styles.ruleSummaryLabel}>
              Rules You Agreed To
            </Text>
          </View>
          <View style={[styles.ruleSummaryCard, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.ruleSummaryNumber}>
              {members.length > 0 && houseRules.filter(rule => rule.agreements && rule.agreements.length >= members.length).length}
            </Text>
            <Text style={styles.ruleSummaryLabel}>
              Unanimous Rules
            </Text>
          </View>
        </View>

        <View style={styles.ruleListContainer}>
          {rulesLoading ? (
            <View style={styles.emptyStateContainer}>
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                Loading house rules...
              </Text>
            </View>
          ) : filteredRules.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="document-text-outline" size={60} color="rgba(150, 150, 150, 0.5)" />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No house rules found
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {ruleFilter
                  ? `No ${ruleFilter} rules exist yet`
                  : 'Create your first house rule to get started'}
              </Text>
            </View>
          ) : (
            filteredRules.map((rule) => renderRuleItem(rule))
          )}
        </View>
        <TouchableOpacity
          style={[styles.createRuleButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowNewRuleModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createRuleButtonText}>Create New Rule</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRuleItem = (rule: HouseRule) => {
    const category = RULE_CATEGORIES.find((cat) => cat.id === rule.category);
    const isExpanded = expandedRule === rule.id;
    const hasAgreed = user && rule.agreements?.some((a) => a.user_id === user.id);
    const isCreator = user && rule.created_by === user.id;

    return (
      <View
        key={createStableKey(rule.id, 'rule')}
        style={[styles.ruleCard, { backgroundColor: theme.colors.card }]}
      >
        <TouchableOpacity
          style={styles.ruleHeader}
          onPress={() => setExpandedRule(isExpanded ? null : rule.id)}
        >
          <View
            style={[
              styles.ruleCategoryBadge,
              { backgroundColor: category ? `${category.color}20` : '#26C6DA20' },
            ]}
          >
            <Ionicons
              name={category?.icon || 'ellipsis-horizontal-outline'}
              size={16}
              color={category?.color || '#26C6DA'}
            />
          </View>
          <View style={styles.ruleTitleContainer}>
            <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{rule.title}</Text>
            <Text style={styles.ruleInfo}>
              Added by {rule.creator_name || 'Unknown'} •{' '}
              {rule.agreements
                ? `${rule.agreements.length} ${
                    rule.agreements.length === 1 ? 'person' : 'people'
                  } agreed`
                : 'No agreements yet'}
            </Text>
          </View>
          <View style={styles.ruleActions}>
            {isCreator && (
              <View style={styles.ruleActionButtons}>
                <TouchableOpacity
                  style={styles.ruleActionButton}
                  onPress={() => {
                    setRuleToEdit(rule);
                    setEditedRule({
                      title: rule.title,
                      description: rule.description,
                      category: rule.category,
                    });
                    setShowEditRuleModal(true);
                  }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={18}
                    color={isDarkMode ? '#999' : '#666'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ruleActionButton}
                  onPress={() => handleDeleteRule(rule.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EB4D4B" />
                </TouchableOpacity>
              </View>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#999"
            />
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.ruleDetails}>
            <Text style={[styles.ruleDescription, { color: theme.colors.text }]}>
              {rule.description}
            </Text>
            <View style={styles.ruleAgreementStatus}>
              <Text
                style={[styles.ruleAgreementLabel, { color: isDarkMode ? '#999' : '#666' }]}
              >
                Agreements:
              </Text>
              <View style={styles.ruleAgreementList}>
                {members.map((member) => {
                  const hasAgreed = rule.agreements?.some((a) => a.user_id === member.user_id);
                  const isCurrentUser = user && member.user_id === user.id;
                  return (
                    <View
                      key={member.user_id}
                      style={[
                        styles.ruleAgreementBadge,
                        hasAgreed
                          ? {
                              backgroundColor: '#2EAF8920',
                              borderColor: '#2EAF89',
                            }
                          : {
                              backgroundColor: 'rgba(150, 150, 150, 0.1)',
                              borderColor: 'rgba(150, 150, 150, 0.2)',
                            },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ruleAgreementPerson,
                          { color: hasAgreed ? '#2EAF89' : '#999' },
                        ]}
                      >
                        {isCurrentUser ? 'You' : member.full_name}
                      </Text>
                      {hasAgreed && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color="#2EAF89"
                          style={styles.ruleCheckIcon}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
            {rule.comments && rule.comments.length > 0 && (
              <View style={styles.ruleCommentsContainer}>
                <Text style={[styles.ruleCommentsTitle, { color: theme.colors.text }]}>
                  Discussion:
                </Text>
                {rule.comments.map((comment, index) => (
                  <View
                    key={createStableKey(`${comment.id}-${index}`, 'comment')}
                    style={[
                      styles.commentItem,
                      {
                        backgroundColor: isDarkMode
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(0,0,0,0.03)',
                      },
                    ]}
                  >
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUserContainer}>
                        <Text
                          style={[
                            styles.commentUser,
                            {
                              color:
                                comment.user_id === user?.id
                                  ? theme.colors.primary
                                  : theme.colors.text,
                            },
                          ]}
                        >
                          {comment.user_id === user?.id ? 'You' : comment.user_name}
                        </Text>
                      </View>
                      <Text style={styles.commentTime}>
                        {new Date(comment.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.commentText, { color: theme.colors.text }]}>
                      {comment.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.addCommentContainer}>
              <TextInput
                style={[
                  styles.commentInput,
                  {
                    color: theme.colors.text,
                    borderColor: isDarkMode ? '#333' : '#eee',
                  },
                ]}
                placeholder="Add your comment..."
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.commentButton,
                  { backgroundColor: theme.colors.primary },
                  !newComment.trim() && { opacity: 0.6 },
                ]}
                disabled={!newComment.trim()}
                onPress={() => handleAddComment(rule.id)}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleAgreementButton,
                hasAgreed
                  ? { backgroundColor: 'rgba(150, 150, 150, 0.1)' }
                  : { backgroundColor: '#2EAF8920' },
              ]}
              onPress={() => handleRuleAgreement(rule.id)}
            >
              <Text
                style={[
                  styles.toggleAgreementText,
                  {
                    color: hasAgreed
                      ? isDarkMode
                        ? '#999'
                        : '#666'
                      : '#2EAF89',
                  },
                ]}
              >
                {hasAgreed ? 'Withdraw Agreement' : 'I Agree to This Rule'}
              </Text>
              <Ionicons
                name={hasAgreed ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={18}
                color={hasAgreed ? (isDarkMode ? '#999' : '#666') : '#2EAF89'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderNewTaskModal = () => {
    return (
      <Modal
        visible={showNewTaskModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewTaskModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Create Chore Task
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowNewTaskModal(false)}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Task Title *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' },
                ]}
                placeholder="Enter task title (e.g. Clean Bathroom)"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newTask.title}
                onChangeText={(text) => setNewTask({ ...newTask, title: text })}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.textAreaInput,
                  { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' },
                ]}
                placeholder="Enter task details and instructions"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newTask.description}
                onChangeText={(text) => setNewTask({ ...newTask, description: text })}
                multiline
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Day of Week</Text>
              <View style={styles.dayOfWeekContainer}>
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayOption,
                      newTask.day_of_week === day && styles.activeDayOption,
                    ]}
                    onPress={() => setNewTask({ ...newTask, day_of_week: day })}
                  >
                    <Text style={styles.dayOptionText}>{day.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Time Slot</Text>
              <View style={styles.timeSlotContainer}>
                {['morning', 'afternoon', 'evening', 'night'].map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.timeSlotOption,
                      newTask.time_slot === slot && styles.activeTimeSlotOption,
                    ]}
                    onPress={() => setNewTask({ ...newTask, time_slot: slot })}
                  >
                    <Text style={styles.timeSlotText}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Assign To {newTask.assigned_to.length > 1 ? '(Multiple People Required)' : '(Select one or more)'}
              </Text>
              
              {newTask.assigned_to.length > 1 && (
                <View style={styles.multipleAssigneeInfo}>
                  <Ionicons name="information-circle-outline" size={16} color="#FF9855" />
                  <Text style={styles.multipleAssigneeText}>
                    Multiple assignees means this task requires {newTask.assigned_to.length} people to complete together
                  </Text>
                </View>
              )}
              
              <View style={styles.assigneeContainer}>
                {members.map((member) => {
                  const isAvailable = isMemberAvailable(
                    member.user_id,
                    newTask.day_of_week,
                    newTask.time_slot
                  );

                  const isSelected = newTask.assigned_to.includes(member.user_id);

                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      style={[
                        styles.assigneeOption,
                        isSelected && styles.activeAssigneeOption,
                        {
                          backgroundColor: isSelected
                            ? '#546DE5'
                            : isAvailable
                            ? 'rgba(46, 175, 137, 0.15)'
                            : 'rgba(150, 150, 150, 0.2)',
                        },
                      ]}
                      onPress={() => {
                        setNewTask((prev) => {
                          const currentAssignees = [...prev.assigned_to];

                          if (isSelected) {
                            const index = currentAssignees.indexOf(member.user_id);
                            if (index !== -1) currentAssignees.splice(index, 1);
                          } else {
                            currentAssignees.push(member.user_id);
                          }

                          return {
                            ...prev,
                            assigned_to: currentAssignees,
                          };
                        });
                      }}
                    >
                      <UserAvatar
                        name={member.full_name}
                        size={30}
                        isCurrentUser={member.user_id === user?.id}
                        showBorder={isSelected}
                      />
                      <Text
                        style={[
                          styles.assigneeOptionText,
                          {
                            color: isSelected ? '#fff' : theme.colors.text,
                            fontWeight: isAvailable ? '600' : '400',
                          },
                        ]}
                      >
                        {member.user_id === user?.id ? 'You' : member.full_name}
                      </Text>
                      {isSelected && (
                        <View style={styles.assigneeSelectedBadge}>
                          <Text style={styles.assigneeSelectedNumber}>{newTask.assigned_to.indexOf(member.user_id) + 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rotationToggleContainer}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Enable Rotation</Text>
                <Switch
                  value={newTask.rotationEnabled}
                  onValueChange={(value) => setNewTask({ ...newTask, rotationEnabled: value })}
                  trackColor={{ false: '#767577', true: theme.colors.primary + '70' }}
                  thumbColor={newTask.rotationEnabled ? theme.colors.primary : '#f4f3f4'}
                />
              </View>

              {newTask.rotationEnabled && (
                <>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    Rotation Frequency
                  </Text>
                  <View style={styles.frequencyContainer}>
                    {['weekly', 'biweekly', 'monthly'].map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[
                          styles.frequencyOption,
                          newTask.rotationFrequency === freq && styles.activeFrequencyOption,
                          {
                            backgroundColor:
                              newTask.rotationFrequency === freq
                                ? theme.colors.primary
                                : 'rgba(150, 150, 150, 0.1)',
                          },
                        ]}
                        onPress={() => setNewTask({ ...newTask, rotationFrequency: freq })}
                      >
                        <Text
                          style={[
                            styles.frequencyOptionText,
                            {
                              color:
                                newTask.rotationFrequency === freq
                                  ? '#fff'
                                  : isDarkMode
                                  ? '#999'
                                  : '#666',
                            },
                          ]}
                        >
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    Rotation Members
                  </Text>
                  {members && members.length > 0 ? (
                    members.map((member) => (
                      <View key={member.user_id} style={styles.rotationMemberRow}>
                        <View style={styles.rotationMemberInfo}>
                          <UserAvatar
                            name={member.full_name}
                            size={24}
                            isCurrentUser={member.user_id === user?.id}
                          />
                          <Text style={{ color: theme.colors.text, marginLeft: 8 }}>
                            {member.user_id === user?.id ? 'You' : member.full_name}
                          </Text>
                        </View>
                        <Switch
                          value={newTask.rotationMembers.includes(member.user_id)}
                          onValueChange={(value) => {
                            if (value) {
                              setNewTask({
                                ...newTask,
                                rotationMembers: [...newTask.rotationMembers, member.user_id],
                              });
                            } else {
                              setNewTask({
                                ...newTask,
                                rotationMembers: newTask.rotationMembers.filter(
                                  (id) => id !== member.user_id
                                ),
                              });
                            }
                          }}
                          trackColor={{ false: '#767577', true: theme.colors.primary + '70' }}
                          thumbColor={
                            newTask.rotationMembers.includes(member.user_id)
                              ? theme.colors.primary
                              : '#f4f3f4'
                          }
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: isDarkMode ? '#999' : '#666', marginTop: 4 }}>
                      No home members found for rotation
                    </Text>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowNewTaskModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  styles.confirmButton,
                  (!newTask.title.trim() || newTask.assigned_to.length === 0) && styles.disabledButton,
                ]}
                onPress={handleCreateTask}
                disabled={!newTask.title.trim() || newTask.assigned_to.length === 0}
              >
                <Text style={styles.confirmButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEvaluateTaskModal = () => {
    if (!taskToEvaluate) return null;

    return (
      <Modal
        visible={showEvaluateTaskModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEvaluateTaskModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Evaluate Task
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowEvaluateTaskModal(false)}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.evaluateTaskInfo}>
                <Text style={[styles.evaluateTaskTitle, { color: theme.colors.text }]}>
                  {taskToEvaluate.title}
                </Text>
                <Text style={styles.evaluateTaskSubtitle}>
                  Completed by {taskToEvaluate.completion_history?.[0]?.completed_by_name || 'Unknown'}
                </Text>
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                How well was this task done?
              </Text>

              <View style={styles.evaluationOptions}>
                {EVALUATION_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.evaluationOption,
                      evaluationRating === option.value && {
                        backgroundColor: option.color + '20',
                        borderColor: option.color,
                      },
                    ]}
                    onPress={() => setEvaluationRating(option.value)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={24}
                      color={evaluationRating === option.value ? option.color : '#999'}
                    />
                    <Text
                      style={[
                        styles.evaluationOptionText,
                        evaluationRating === option.value && {
                          color: option.color,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.penalty && (
                      <Text
                        style={[
                          styles.penaltyText,
                          { color: option.color },
                        ]}
                      >
                        {option.penalty} pt{option.penalty !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Notes (Optional)</Text>
              <TextInput
                style={[
                  styles.textAreaInput,
                  { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' },
                ]}
                placeholder="Provide feedback about the task"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={evaluationNotes}
                onChangeText={setEvaluationNotes}
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowEvaluateTaskModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.confirmButton]}
                onPress={submitTaskEvaluation}
              >
                <Text style={styles.confirmButtonText}>Submit Evaluation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderNewRuleModal = () => {
    return (
      <Modal
        visible={showNewRuleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewRuleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Create House Rule
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowNewRuleModal(false)}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollContent}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Rule Title *</Text>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                placeholder="Enter rule title"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newRule.title}
                onChangeText={(text) => setNewRule({...newRule, title: text})}
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description *</Text>
              <TextInput
                style={[styles.textAreaInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                placeholder="Enter rule description"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newRule.description}
                onChangeText={(text) => setNewRule({...newRule, description: text})}
                multiline
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Category</Text>
              <View style={styles.ruleCategoriesSelection}>
                {RULE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.ruleCategoryOption,
                      newRule.category === category.id && { backgroundColor: category.color + '20', borderColor: category.color }
                    ]}
                    onPress={() => setNewRule({...newRule, category: category.id})}
                  >
                    <Ionicons
                      name={category.icon}
                      size={20}
                      color={category.color}
                      style={styles.ruleCategoryIcon}
                    />
                    <Text 
                      style={[
                        styles.ruleCategoryOptionText, 
                        {color: newRule.category === category.id ? category.color : isDarkMode ? '#999' : '#666'}
                      ]}
                    >
                      {category.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowNewRuleModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalActionButton, 
                  styles.confirmButton,
                  (!newRule.title || !newRule.description) && styles.disabledButton
                ]}
                onPress={handleCreateRule}
                disabled={!newRule.title || !newRule.description}
              >
                <Text style={styles.confirmButtonText}>Create Rule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEditRuleModal = () => {
    return (
      <Modal
        visible={showEditRuleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditRuleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Edit House Rule
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowEditRuleModal(false)}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollContent}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Rule Title *</Text>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                placeholder="Enter rule title"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={editedRule.title}
                onChangeText={(text) => setEditedRule(prev => ({...prev, title: text}))}
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description *</Text>
              <TextInput
                style={[styles.textAreaInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                placeholder="Enter rule description"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={editedRule.description}
                onChangeText={(text) => setEditedRule(prev => ({...prev, description: text}))}
                multiline
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Category</Text>
              <View style={styles.ruleCategoriesSelection}>
                {RULE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.ruleCategoryOption,
                      editedRule.category === category.id && { backgroundColor: category.color + '20', borderColor: category.color }
                    ]}
                    onPress={() => setEditedRule(prev => ({...prev, category: category.id}))}
                  >
                    <Ionicons
                      name={category.icon}
                      size={20}
                      color={category.color}
                      style={styles.ruleCategoryIcon}
                    />
                    <Text 
                      style={[
                        styles.ruleCategoryOptionText, 
                        {color: editedRule.category === category.id ? category.color : isDarkMode ? '#999' : '#666'}
                      ]}
                    >
                      {category.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowEditRuleModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalActionButton, 
                  styles.confirmButton,
                  (!editedRule.title || !editedRule.description) && styles.disabledButton
                ]}
                onPress={handleEditRule}
                disabled={!editedRule.title || !editedRule.description}
              >
                <Text style={styles.confirmButtonText}>Update Rule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Add this function right after your getFilteredTasks function to help diagnose the issue
  const debugTaskAssignments = () => {
    console.log("========== DEBUG TASK ASSIGNMENTS ==========");
    if (!tasks || tasks.length === 0) {
      console.log("No tasks available to debug");
      return;
    }
    
    tasks.forEach(task => {
      console.log(`Task: ${task.title} (ID: ${task.id})`);
      console.log(`  requires_multiple_people: ${task.requires_multiple_people}`);
      console.log(`  assigned_to: ${JSON.stringify(task.assigned_to)}`);
      console.log(`  created_by: ${task.created_by}`);
      console.log(`  task_assignees: ${JSON.stringify(task.task_assignees)}`);
      
      // Check if the current user is considered assigned to this task
      const isAssigned = 
        (Array.isArray(task.assigned_to) && task.assigned_to.includes(user?.id)) ||
        (task.assigned_to === user?.id) ||
        (task.task_assignees && Array.isArray(task.task_assignees) && 
         task.task_assignees.some(assignee => assignee.user_id === user?.id)) ||
        (task.requires_multiple_people && task.created_by === user?.id && !task.assigned_to);
      
      console.log(`  Current user (${user?.id}) assigned: ${isAssigned}`);
      
      // When task should appear in "My Tasks" but doesn't, log detailed reasons
      if (task.requires_multiple_people && !isAssigned) {
        console.log("  ISSUE DETECTED: Multi-person task that current user might be assigned to but isn't showing");
        console.log(`  Do task_assignees exist? ${task.task_assignees ? 'Yes' : 'No'}`);
        if (task.task_assignees) {
          console.log(`  task_assignees structure: ${typeof task.task_assignees} with length ${task.task_assignees.length}`);
          console.log(`  User IDs in task_assignees: ${task.task_assignees.map(a => a.user_id).join(', ')}`);
        }
      }
    });
    console.log("===========================================");
  };

  // Call this debug function in useEffect
  useEffect(() => {
    if (tasks && tasks.length > 0 && user?.id) {
      debugTaskAssignments();
    }
  }, [tasks, user?.id]);

  const renderSwapRequestModal = () => {
    if (!taskToSwap) return null;
  
    return (
      <Modal
        visible={showSwapRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSwapRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Request Task Swap
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSwapRequestModal(false)}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>
  
            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.swapTaskInfo}>
                <Text style={[styles.swapTaskTitle, { color: theme.colors.text }]}>
                  {taskToSwap.title}
                </Text>
                <Text style={styles.swapTaskDate}>
                  Due on: {new Date(taskToSwap.due_date || '').toLocaleDateString()}
                </Text>
              </View>
  
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Request Swap With
              </Text>
              <View style={styles.assigneeContainer}>
                {members.filter(m => m.user_id !== user?.id).map((member) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[
                      styles.assigneeOption,
                      swapRequest.requestedTo === member.user_id && styles.activeAssigneeOption,
                      {
                        backgroundColor: swapRequest.requestedTo === member.user_id
                          ? '#546DE5'
                          : 'rgba(150, 150, 150, 0.1)',
                      },
                    ]}
                    onPress={() => setSwapRequest({
                      ...swapRequest,
                      requestedTo: member.user_id
                    })}
                  >
                    <UserAvatar
                      name={member.full_name}
                      size={30}
                      isCurrentUser={false}
                      showBorder={swapRequest.requestedTo === member.user_id}
                    />
                    <Text
                      style={[
                        styles.assigneeOptionText,
                        {
                          color: swapRequest.requestedTo === member.user_id ? '#fff' : theme.colors.text,
                        },
                      ]}
                    >
                      {member.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
  
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Message (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textAreaInput,
                  { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' },
                ]}
                placeholder="Add a message to explain your swap request..."
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={swapRequest.message}
                onChangeText={(text) => setSwapRequest({ ...swapRequest, message: text })}
                multiline
              />
            </ScrollView>
  
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowSwapRequestModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  styles.confirmButton,
                  !swapRequest.requestedTo && styles.disabledButton,
                ]}
                onPress={submitSwapRequest}
                disabled={!swapRequest.requestedTo}
              >
                <Text style={styles.confirmButtonText}>Send Request</Text>
              </TouchableOpacity>
            </View>styles.container, { backgroundColor: theme.colors.background }]}>
          </View>' : 'dark'} />
        </View>
      </Modal>{[
                style={[08)',
                  styles.modalActionButton,109, 229, 0.05)' : 'rgba(84, 109, 229, 0.02)',
                  styles.confirmButton,ent',
                  !swapRequest.requestedTo && styles.disabledButton,
                ]}{ x: 0, y: 0 }}
                onPress={submitSwapRequest} x: 0, y: 0.6 }}
                disabled={!swapRequest.requestedTo}  style={styles.headerGradient}
              >  />
                <Text style={styles.confirmButtonText}>Send Request</Text>      <View style={styles.islandContainer}>
              </TouchableOpacity>omeIsland
            </View>
          </View>
        </View>ss={handleIslandAction}
      </Modal>ion={navigation}
    );
  };
,
  return (  tasks,
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <LinearGradient
        colors={[/>
          isDarkMode ? 'rgba(84, 109, 229, 0.15)' : 'rgba(84, 109, 229, 0.08)',
          isDarkMode ? 'rgba(84, 109, 229, 0.05)' : 'rgba(84, 109, 229, 0.02)',
          'transparent',lView}
        ]}scrollContent}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={styles.headerGradient}
      />shing={refreshing}
      <View style={styles.islandContainer}>Refresh}
        <HomeIslandlor="#546DE5"
          mode={islandMode}546DE5']}
          onModeChange={setIslandMode}
          onActionPress={handleIslandAction}
          navigation={navigation}Scroll={Animated.event(
          contextMode="home"nativeEvent: { contentOffset: { y: scrollY } } }],
          data={{tiveDriver: false }
            expenses: [],
            tasks,
            events: [],
            furniture: [],
          }}
        />
      </View>
      <ScrollViewimation,
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}    {
        showsVerticalScrollIndicator={false}         translateY: headerAnimation.interpolate({
        refreshControl={0, 1],
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}      },
            tintColor="#546DE5"
            colors={['#546DE5']}     },
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16} style={styles.headerSubtitle}>
      >
        <Animated.View
          style={[
            styles.header,enaltyPoints() > 0 && (
            {style={styles.penaltyBadge}>
              opacity: headerAnimation,onicons name="alert-circle" size={16} color="#EB4D4B" />
              transform: [<Text style={styles.penaltyText}>{calculatePenaltyPoints()} penalty points</Text>
                {</View>
                  translateY: headerAnimation.interpolate({ )}
                    inputRange: [0, 1],ed.View>
                    outputRange: [-20, 0],
                  }),
                },[
              ],
            },activeTabButton,
          ]}derBottomColor: activeTab === 'tasks' ? theme.colors.primary : 'transparent' },
        >
          <View>ks')}
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Chores & Rules
            </Text>
            <Text style={styles.headerSubtitle}>{22}
              Manage household tasks and rules  color={activeTab === 'tasks' ? theme.colors.primary : '#999'}
            </Text>
          </View>
          {calculatePenaltyPoints() > 0 && (
            <View style={styles.penaltyBadge}>es.tabButtonText,
              <Ionicons name="alert-circle" size={16} color="#EB4D4B" />
              <Text style={styles.penaltyText}>{calculatePenaltyPoints()} penalty points</Text>primary : '#999',
            </View>
          )}  },
        </Animated.View>
        <View style={styles.tabBar}> >
          <TouchableOpacity
            style={[
              styles.tabButton,acity>
              activeTab === 'tasks' && styles.activeTabButton,
              { borderBottomColor: activeTab === 'tasks' ? theme.colors.primary : 'transparent' },yle={[
            ]}les.tabButton,
            onPress={() => setActiveTab('tasks')}b === 'rules' && styles.activeTabButton,
          >tiveTab === 'rules' ? theme.colors.primary : 'transparent' },
            <Ionicons
              name="checkbox-outline"
              size={22}
              color={activeTab === 'tasks' ? theme.colors.primary : '#999'}ons
            />me="document-text-outline"
            <Text size={22}
              style={[{activeTab === 'rules' ? theme.colors.primary : '#999'}
                styles.tabButtonText,
                {
                  color: activeTab === 'tasks' ? theme.colors.primary : '#999',
                  fontWeight: activeTab === 'tasks' ? '600' : '400',es.tabButtonText,
                },
              ]}primary : '#999',
            >
              Chores  },
            </Text>
          </TouchableOpacity> >
          <TouchableOpacity
            style={[
              styles.tabButton,acity>
              activeTab === 'rules' && styles.activeTabButton,
              { borderBottomColor: activeTab === 'rules' ? theme.colors.primary : 'transparent' },ted.View
            ]}[
            onPress={() => setActiveTab('rules')}ContentContainer,
          >
            <Ioniconscity: contentAnimation,
              name="document-text-outline"
              size={22}
              color={activeTab === 'rules' ? theme.colors.primary : '#999'}translateY: contentAnimation.interpolate({
            />    inputRange: [0, 1],
            <Text       outputRange: [20, 0],
              style={[),
                styles.tabButtonText,
                {
                  color: activeTab === 'rules' ? theme.colors.primary : '#999',
                  fontWeight: activeTab === 'rules' ? '600' : '400',
                },
              ]}erTasksTab() : renderRulesTab()}
            >mated.View>
              Rules
            </Text>)}
          </TouchableOpacity>uleModal()}
        </View>
        <Animated.View
          style={[this line */}
            styles.tabContentContainer,
            {
              opacity: contentAnimation,
              transform: [
                { = StyleSheet.create({
                  translateY: contentAnimation.interpolate({er: {
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {activeTab === 'tasks' ? renderTasksTab() : renderRulesTab()}
        </Animated.View>rollView: {
      </ScrollView>  flex: 1,
      {renderNewTaskModal()}  },
      {renderNewRuleModal()}
      {renderEditRuleModal()}: Platform.OS === 'ios' ? 130 : 110,
      {renderEvaluateTaskModal()}orizontal: 20,
      {renderSwapRequestModal()} {/* Add this line */}paddingBottom: 100,
    </View>
  );
};: 'absolute',
form.OS === 'ios' ? 10 : 90,
const styles = StyleSheet.create({,
  container: {
    flex: 1,zIndex: 50,
  }, 'center',
  headerGradient: {
    position: 'absolute',ader: {
    left: 0, 'row',
    right: 0,
    top: 0,
    height: 300,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {ttom: 6,
    paddingTop: Platform.OS === 'ios' ? 130 : 110,
    paddingHorizontal: 20,e: {
    paddingBottom: 100,
  },color: '#666',
  islandContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 90,
    left: 0,
    right: 0,'rgba(235, 77, 75, 0.1)',
    zIndex: 50,paddingVertical: 6,
    alignItems: 'center',ontal: 10,
  }, 16,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',fontSize: 12,
    alignItems: 'center',0',
    marginBottom: 24,4B',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  headerSubtitle: {'rgba(150, 150, 150, 0.2)',
    fontSize: 15,
    color: '#666',
  },flex: 1,
  penaltyBadge: {n: 'row',
    flexDirection: 'row',center',
    alignItems: 'center',enter',
    backgroundColor: 'rgba(235, 77, 75, 0.1)',12,
    paddingVertical: 6,dth: 2,
    paddingHorizontal: 10,
    borderRadius: 16,Button: {
  },
  penaltyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EB4D4B',marginLeft: 8,
    marginLeft: 4,
  },Container: {
  tabBar: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },lterContainer: {
  tabButton: {row',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',al: 8,
    paddingVertical: 12,tal: 16,
    borderBottomWidth: 2,borderRadius: 20,
  },
  activeTabButton: {
    borderBottomWidth: 2,tiveFilterButton: {
  },olor: '#546DE5',
  tabButtonText: {
    fontSize: 16,lterText: {
    marginLeft: 8,
  },
  tabContentContainer: {
    flex: 1,skListContainer: {
  }, 20,
  tabContent: {
    flex: 1,
  },r',
  filterContainer: {
    flexDirection: 'row',color: '#999',
    marginBottom: 16,
  },
  filterButton: {borderRadius: 16,
    paddingVertical: 8,,
    paddingHorizontal: 16, 12,
    borderRadius: 20,',
    marginRight: 12,shadowOffset: { width: 0, height: 4 },
  },8,
  activeFilterButton: {
    backgroundColor: '#546DE5',elevation: 3,
  },
  filterText: {
    fontSize: 14,n: 'row',
    fontWeight: '500',enter',
  },marginBottom: 12,
  taskListContainer: {
    marginBottom: 20,{
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
    color: '#999',,
  },
  taskCard: {
    borderRadius: 16,skTitleContainer: {
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,fontWeight: '600',
    shadowRadius: 8,
    elevation: 3,
  },Title: {
  taskHeader: {e: 'line-through',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },fontSize: 13,
  taskIconContainer: {
    width: 40,p: 2,
    height: 40,
    borderRadius: 20,Container: {
    justifyContent: 'center',,
    alignItems: 'center',r',
    marginRight: 12,
  },signeeName: {
  taskTitleContainer: {
    flex: 1,
  },
  taskTitle: {textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2, 'row',
  },,
  completedTaskTitle: {alignItems: 'center',
    textDecorationLine: 'line-through',
    color: '#999',: {
  },
  taskDescription: {alignItems: 'center',
    fontSize: 13,al: 8,
    color: '#999',ntal: 12,
    marginTop: 2,
  },10,
  taskAssigneeContainer: {
    marginLeft: 8,mpleteButton: {
    alignItems: 'center',lor: '#2EAF89',
  },
  assigneeName: {
    fontSize: 12,B731',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',59B6',
  },
  taskActions: {
    flexDirection: 'row',
    marginTop: 12,',
    alignItems: 'center',
  },marginLeft: 6,
  taskActionButton: {
    flexDirection: 'row',
    alignItems: 'center',flexDirection: 'row',
    paddingVertical: 8, 'center',
    paddingHorizontal: 12,
    borderRadius: 8,mpletedStatusText: {
    marginRight: 10,
  },
  completeButton: {marginLeft: 4,
    backgroundColor: '#2EAF89',
  },
  swapButton: {w',
    backgroundColor: '#F7B731',enter',
  },
  evaluateButton: {paddingTop: 12,
    backgroundColor: '#9B59B6',
  },(150, 150, 150, 0.2)',
  actionButtonText: {
    fontSize: 14,tationText: {
    fontWeight: '500',
    color: '#fff',,
    marginLeft: 6,
  },
  completedStatusContainer: {ctionHeader: {
    flexDirection: 'row',: 'row',
    alignItems: 'center',e-between',
  },
  completedStatusText: {12,
    fontSize: 13,
    color: '#2EAF89',
    marginLeft: 4,
  },fontWeight: '600',
  rotationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,5',
    paddingTop: 12,
    borderTopWidth: 1,ainer: {
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  rotationText: {
    fontSize: 12,
    color: '#999',padding: 16,
    marginLeft: 4, 12,
  },'#000',
  sectionHeader: {dth: 0, height: 4 },
    flexDirection: 'row',shadowOpacity: 0.08,
    justifyContent: 'space-between',s: 8,
    alignItems: 'center',
    marginBottom: 12,
  },apRequestInfo: {
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',apRequestTitle: {
  },
  seeAllText: {,
    fontSize: 14,: 4,
    color: '#546DE5',
  },
  swapRequestsContainer: {
    marginBottom: 24,
  },
  swapRequestCard: {
    borderRadius: 16,apRequestMessage: {
    padding: 16, 'rgba(150, 150, 150, 0.1)',
    marginBottom: 12,
    shadowColor: '#000',padding: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,xt: {
    elevation: 3,
  },fontStyle: 'italic',
  swapRequestInfo: {
    marginBottom: 12,
  },ns: {
  swapRequestTitle: {row',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  }, 10,
  swapRequestDetails: {'center',
    fontSize: 13, 8,
    color: '#999',marginRight: 10,
    marginBottom: 8,
  },
  swapRequestMessage: {EAF89',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,a(150, 150, 150, 0.2)',
  },
  swapRequestMessageText: {t: {
    fontSize: 14,: 14,
    fontStyle: 'italic',
    color: '#777',
  },
  swapRequestActions: {r: {
    flexDirection: 'row',alignItems: 'center',
  },t: 'center',
  swapActionButton: {
    flex: 1,
    paddingVertical: 10,ptyStateText: {
    alignItems: 'center',
    borderRadius: 8,
    marginRight: 10,marginTop: 16,
  },
  acceptButton: {
    backgroundColor: '#2EAF89',
    marginRight: 8,
  },color: '#999',
  rejectButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  swapActionButtonText: {
    fontSize: 14,backgroundColor: 'rgba(0,0,0,0.5)',
    fontWeight: '500', 'center',
    color: '#fff',center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',width: '95%',
    padding: 30,
  }, 20,
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',shadowOffset: { width: 0, height: 10 },
    marginTop: 16,: 0.25,
    marginBottom: 4,dius: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',n: 'row',
    textAlign: 'center',justifyContent: 'space-between',
  },center',
  modalOverlay: { 15,
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',,
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '95%',
    maxHeight: '80%',dalScrollContent: {
    borderRadius: 20,50,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,,
    shadowRadius: 10,marginTop: 15,
    elevation: 10,m: 6,
  },
  modalHeader: {
    flexDirection: 'row',borderWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',ical: 10,
    marginBottom: 15,paddingHorizontal: 15,
  },
  modalTitle: {
    fontSize: 20,xtAreaInput: {
    fontWeight: '600',: 1,
  }, 10,
  modalCloseButton: {0,
    padding: 5,tal: 15,
  },
  modalScrollContent: {minHeight: 100,
    maxHeight: 450,ertical: 'top',
  },
  inputLabel: {: {
    fontSize: 14,,
    fontWeight: '500',
    marginTop: 15,l: 8,
    marginBottom: 6,
  },{
  textInput: {: 8,
    borderWidth: 1,: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15, 8,
    fontSize: 16,: 'rgba(150, 150, 150, 0.1)',
  },
  textAreaInput: {tiveCategoryOption: {
    borderWidth: 1,ba(84, 109, 229, 0.2)',
    borderRadius: 10,
    paddingVertical: 10, {
    paddingHorizontal: 15,
    fontSize: 16,fontWeight: '500',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoriesContainer: {
    flexDirection: 'row', 8,
    flexWrap: 'wrap',
    marginVertical: 8,
  },flexDirection: 'row',
  categoryOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,8,
    marginBottom: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  activeCategoryOption: {
    backgroundColor: 'rgba(84, 109, 229, 0.2)','#546DE5',
  },
  categoryOptionText: {signeeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  assigneeContainer: {
    flexDirection: 'row', {
    flexWrap: 'wrap',ow',
    marginVertical: 8, 'space-between',
  },ter',
  assigneeOption: {
    flexDirection: 'row',
    alignItems: 'center',r: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,: 'row',
    marginBottom: 8,pace-between',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',enter',
  },paddingVertical: 10,
  activeAssigneeOption: {
    backgroundColor: '#546DE5',gba(150, 150, 150, 0.2)',
  },
  assigneeOptionText: {
    fontSize: 14,',
    fontWeight: '500',justifyContent: 'space-between',
    marginLeft: 8,
  },
  rotationToggleContainer: {dalActionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  rotationMembersContainer: {
    marginVertical: 8,
  },marginRight: 10,
  rotationMemberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)', 0.5,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',fontWeight: '500',
    marginTop: 20,,
  },
  modalActionButton: { {
    flex: 1,fontSize: 16,
    padding: 14,00',
    borderRadius: 10,
    alignItems: 'center',
  },leCategoriesContainer: {
  cancelButton: {'row',
    backgroundColor: 'rgba(150, 150, 150, 0.2)',al: 8,
    marginRight: 10,paddingRight: 16,
  },
  confirmButton: {utton: {
    backgroundColor: '#546DE5',w',
    marginLeft: 10,enter',
  },paddingVertical: 6,
  disabledButton: { 10,
    opacity: 0.5, 16,
  },
  cancelButtonText: {: 'rgba(150, 150, 150, 0.1)',
    fontSize: 16,
    fontWeight: '500',
    color: '#666',6DE5',
  },
  confirmButtonText: { {
    fontSize: 16,fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
  ruleCategoriesContainer: {
    flexDirection: 'row',
    paddingVertical: 8,space-between',
    paddingRight: 16, 16,
  },
  categoryFilterButton: {leSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,borderRadius: 12,
    paddingHorizontal: 10,',
    borderRadius: 16,t: 'center',
    marginRight: 8,',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',{ width: 0, height: 2 },
  },shadowOpacity: 0.06,
  activeCategoryFilter: { 5,
    backgroundColor: '#546DE5',
  },
  categoryFilterText: {
    fontSize: 12,fontSize: 18,
    fontWeight: '500',',
    marginLeft: 4,E5',
  },m: 4,
  rulesSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  ruleSummaryCard: {
    width: '31%', {
    height: 70, 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center', 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },',
    shadowOpacity: 0.06,00',
    shadowRadius: 5,shadowOffset: { width: 0, height: 4 },
    elevation: 2,08,
  }, 8,
  ruleSummaryNumber: {
    fontSize: 18,
    fontWeight: '700',leHeader: {
    color: '#546DE5',w',
    marginBottom: 4,er',
  },padding: 16,
  ruleSummaryLabel: {
    fontSize: 11,{
    color: '#999',
    textAlign: 'center',
  },
  ruleListContainer: {
    marginBottom: 20,ter',
  },
  ruleCard: {
    borderRadius: 16,leTitleContainer: {
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },,
    shadowOpacity: 0.08,fontWeight: '600',
    shadowRadius: 8,
    elevation: 3,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },padding: 4,
  ruleCategoryBadge: {
    width: 36,Buttons: {
    height: 36,flexDirection: 'row',
    borderRadius: 18,t: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },marginLeft: 4,
  ruleTitleContainer: {
    flex: 1,
  },
  ruleTitle: {paddingTop: 0,
    fontSize: 16,th: 1,
    fontWeight: '600',lor: 'rgba(150, 150, 150, 0.1)',
    marginBottom: 2,
  },
  ruleInfo: {
    fontSize: 12,
    color: '#999',marginBottom: 16,
  },
  ruleActions: {Status: {
    padding: 4,16,
  },
  ruleActionButtons: {abel: {
    flexDirection: 'row',,
    marginRight: 8,00',
  },
  ruleActionButton: {
    padding: 5,leAgreementList: {
    marginLeft: 4,row',
  },ap',
  ruleDetails: {
    padding: 16, {
    paddingTop: 0,flexDirection: 'row',
    borderTopWidth: 1,,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },borderRadius: 14,
  ruleDescription: {
    fontSize: 14,ntal: 10,
    lineHeight: 20,
    marginBottom: 16,
  },
  ruleAgreementStatus: { {
    marginBottom: 16,
  },,
  ruleAgreementLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },iner: {
  ruleAgreementList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ruleAgreementBadge: {',
    flexDirection: 'row',marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 4,borderRadius: 8,
    paddingHorizontal: 10,8,
    marginRight: 8,
    marginBottom: 8,mmentHeader: {
  },
  ruleAgreementPerson: {space-between',
    fontSize: 12,marginBottom: 4,
    fontWeight: '500',
  },ainer: {
  ruleCheckIcon: {w',
    marginLeft: 4,ter',
  },
  ruleCommentsContainer: {
    marginBottom: 16,,
  },',
  ruleCommentsTitle: {
    fontSize: 14,mmentTime: {
    fontWeight: '500',
    marginBottom: 8,
  },
  commentItem: {
    padding: 10,fontSize: 13,
    borderRadius: 8,
    marginBottom: 8,
  },
  commentHeader: {flexDirection: 'row',
    flexDirection: 'row','center',
    justifyContent: 'space-between', 16,
    marginBottom: 4,
  },mmentInput: {
  commentUserContainer: {
    flexDirection: 'row',1,
    alignItems: 'center',20,
  },paddingVertical: 8,
  commentUser: {ontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 11,
    color: '#999',
  },
  commentText: {alignItems: 'center',
    fontSize: 13,t: 'center',
    lineHeight: 18,ft: 8,
  },
  addCommentContainer: {on: {
    flexDirection: 'row',',
    alignItems: 'center',
    marginBottom: 16,t: 'center',
  },l: 10,
  commentInput: {borderRadius: 8,
    flex: 1,
    borderWidth: 1,entText: {
    borderRadius: 20,4,
    paddingVertical: 8,,
    paddingHorizontal: 12,
    fontSize: 14,
    maxHeight: 80,: {
  },flexDirection: 'row',
  commentButton: {
    width: 36,er',
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,eateRuleButtonText: {
  },
  toggleAgreementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,iner: {
    borderRadius: 8,
  },
  toggleAgreementText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },width: 60,
  createRuleButton: {
    flexDirection: 'row',,
    alignItems: 'center', 12,
    justifyContent: 'center',r',
    paddingVertical: 14,: 'center',
    borderRadius: 10,padding: 8,
    marginBottom: 20,
  },idth: 0, height: 1 },
  createRuleButtonText: {shadowOpacity: 0.1,
    color: '#fff', 2,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8, {
  },h: 1,
  weeklyCalendarContainer: {: '#546DE5',
    marginBottom: 20,
  },
  calendarList: {',
    paddingVertical: 8,
  },4,
  dayCard: {
    width: 60,
    height: 80,
    marginRight: 8,',
    borderRadius: 12,,
    alignItems: 'center',marginBottom: 5,
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },fontWeight: '700',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },solute',
  todayCard: {bottom: -5,
    borderWidth: 1,0,
    borderColor: '#546DE5',
  },
  selectedDayCard: {r: '#546DE5',
    shadowColor: '#546DE5','center',
    shadowOpacity: 0.3,alignItems: 'center',
    elevation: 4,
  },dge: {
  dayName: {e',
    fontSize: 12,
    fontWeight: '500',width: 20,
    color: '#999',
    marginBottom: 5,
  },olor: '#bbb',
  dayDate: {tent: 'center',
    fontSize: 18, 'center',
    fontWeight: '700',
    color: '#666',
  },
  taskCountBadge: {
    position: 'absolute',color: '#fff',
    bottom: -5,
    width: 20,
    height: 20,on: 'row',
    borderRadius: 10,tent: 'space-between',
    backgroundColor: '#546DE5', 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allTasksCountBadge: {
    position: 'absolute',fontWeight: '600',
    bottom: -5,
    width: 20,{
    height: 20,w',
    borderRadius: 10,enter',
    backgroundColor: '#bbb',paddingVertical: 6,
    justifyContent: 'center', 12,
    alignItems: 'center',
  },
  taskCountText: {
    fontSize: 10,
    fontWeight: '700',fontWeight: '500',
    color: '#fff',
  },,
  selectedDayHeader: {
    flexDirection: 'row',skHeaderBar: {
    justifyContent: 'space-between',olute',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedDayText: {
    fontSize: 18,us: 16,
    fontWeight: '600',borderTopRightRadius: 16,
  },idden',
  addTaskButton: {
    flexDirection: 'row',or: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,ew: {
  },
  addTaskText: {
    fontSize: 14,ip: {
    fontWeight: '500',tion: 'row',
    color: '#fff',: 'center',
    marginLeft: 4,
  },
  taskHeaderBar: {
    position: 'absolute',marginRight: 8,
    top: 0,
    left: 0,r: 'rgba(150, 150, 150, 0.2)',
    right: 0,
    height: 6,tegoryChipText: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },: {
  categoryColorIndicator: {
    height: 6,
    width: '100%',
  },ba(150, 150, 150, 0.2)',
  categoryScrollView: {
    marginVertical: 10,r: {
  },'row',
  categoryChip: {
    flexDirection: 'row',marginVertical: 8,
    alignItems: 'center',
    paddingHorizontal: 12,: {
    paddingVertical: 8,l: 8,
    borderRadius: 20,paddingHorizontal: 12,
    marginRight: 8,,
    borderWidth: 1,,
    borderColor: 'rgba(150, 150, 150, 0.2)',,
  },
  categoryChipText: {
    fontSize: 14,backgroundColor: '#546DE5',
    marginLeft: 6,
  },
  rotationSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,: {
    borderTopColor: 'rgba(150, 150, 150, 0.2)',',
  },
  frequencyContainer: {
    flexDirection: 'row',iner: {
    flexWrap: 'wrap',row',
    marginVertical: 8,flexWrap: 'wrap',
  },
  frequencyOption: {
    paddingVertical: 8,nsequenceOption: {
    paddingHorizontal: 12,
    borderRadius: 20,ntal: 12,
    marginRight: 8,
    marginBottom: 8,marginRight: 8,
  },
  activeFrequencyOption: {
    backgroundColor: '#546DE5',: {
  },backgroundColor: '#546DE5',
  frequencyOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rotationMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consequencesContainer: { 'rgba(150, 150, 150, 0.1)',
    flexDirection: 'row',,
    flexWrap: 'wrap',
    marginVertical: 8,aluateTaskTitle: {
  },
  consequenceOption: {
    paddingVertical: 8,marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 8,title: {
    marginRight: 8,
    marginBottom: 8,color: '#999',
  },
  activeConsequenceOption: {{
    backgroundColor: '#546DE5',n: 'row',
  },
  consequenceText: {10,
    fontSize: 14,justifyContent: 'space-between',
    fontWeight: '500',
  },n: {
  evaluateTaskInfo: {
    marginBottom: 15,ter',
    padding: 10,justifyContent: 'center',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 8, 10,
  },8,
  evaluateTaskTitle: {borderWidth: 1,
    fontSize: 16,(150, 150, 150, 0.2)',
    fontWeight: '600',
    marginBottom: 4,t: {
  },
  evaluateTaskSubtitle: {
    fontSize: 14,color: '#999',
    color: '#999',
  },
  evaluationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',,
    marginVertical: 10,
    justifyContent: 'space-between',ontainer: {
  },'row',
  evaluationOption: {
    width: '48%',justifyContent: 'space-between',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,or: 'rgba(235, 77, 75, 0.1)',
    marginBottom: 10,8,
    borderRadius: 8,
    borderWidth: 1,iner: {
    borderColor: 'rgba(150, 150, 150, 0.2)',: 'row',
  },
  evaluationOptionText: {l: 8,
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },,
  penaltyText: {
    fontSize: 12,,
    fontWeight: '600',: 8,
    marginTop: 4,',
  },
  consequenceToggleContainer: {tiveDayOption: {
    flexDirection: 'row',546DE5',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
    padding: 10,fontWeight: '500',
    backgroundColor: 'rgba(235, 77, 75, 0.1)',66',
    borderRadius: 8,
  },
  dayOfWeekContainer: {ow',
    flexDirection: 'row',',
    flexWrap: 'wrap',8,
    marginVertical: 8,
  },meSlotOption: {
  dayOption: { 8,
    paddingVertical: 8,
    paddingHorizontal: 12,borderRadius: 20,
    borderRadius: 20,,
    marginRight: 8, 8,
    marginBottom: 8,rgba(150, 150, 150, 0.1)',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },tiveTimeSlotOption: {
  activeDayOption: {#546DE5',
    backgroundColor: '#546DE5',
  },
  dayOptionText: {
    fontSize: 14,fontWeight: '500',
    fontWeight: '500',
    color: '#666',
  },
  timeSlotContainer: {ow',
    flexDirection: 'row',nter',
    flexWrap: 'wrap', 'rgba(255, 152, 85, 0.1)',
    marginVertical: 8,
  },paddingHorizontal: 12,
  timeSlotOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,eText: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },flex: 1,
  activeTimeSlotOption: {
    backgroundColor: '#546DE5',{
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '500',',
    color: '#666','center',
  },er',
  multipleAssigneeInfo: {position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 85, 0.1)',
    paddingVertical: 8,Number: {
    paddingHorizontal: 12,: 10,
    borderRadius: 8,fontWeight: 'bold',
    marginBottom: 10,
  },
  multipleAssigneeText: {redBadge: {
    fontSize: 12,row',
    color: '#FF9855',
    marginLeft: 6,5, 152, 85, 0.1)',
    flex: 1,
  },
  assigneeSelectedBadge: {adius: 12,
    width: 18,: 'flex-start',
    height: 18,marginTop: 8,
    borderRadius: 9,
    backgroundColor: '#fff',
    justifyContent: 'center', {
    alignItems: 'center',
    position: 'absolute',color: '#FF9855',
    top: 4,
    right: 4,
  },
  assigneeSelectedNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#546DE5','rgba(150, 150, 150, 0.1)',
  },
  multipleRequiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',fontSize: 16,
    backgroundColor: 'rgba(255, 152, 85, 0.1)',
    paddingVertical: 4, 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,color: '#999',
    marginBottom: 4,
  }, {
  multipleRequiredText: {: 15,
    fontSize: 12,
    color: '#FF9855',
    marginLeft: 4,
    fontWeight: '500',ksScreen;  },  swapTaskInfo: {    marginBottom: 15,    padding: 10,    backgroundColor: 'rgba(150, 150, 150, 0.1)',    borderRadius: 8,  },  swapTaskTitle: {    fontSize: 16,    fontWeight: '600',    marginBottom: 4,  },  swapTaskDate: {    fontSize: 14,
    color: '#999',
  },
  dateInputContainer: {
    marginBottom: 15,
  },
});

export default TasksScreen;