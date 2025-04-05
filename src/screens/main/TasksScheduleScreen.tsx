import React, { useState, useEffect, useRef } from 'react';
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
import UserAvatar from '../../components/common/UserAvatar';
import { HouseRule, RuleComment } from '../../services/api/houseRulesService';
import { fetchUserHomeMembership } from '../../services/api/homeService';
import { createUniqueKey, createStableKey } from '../../utils/keyHelper';

const { width } = Dimensions.get('window');

// Mock data for tasks
const MOCK_TASKS = [
  {
    id: '1',
    title: 'Kitchen Cleaning',
    description: 'Clean countertops, sink, and appliances',
    assignedTo: 'You',
    dueDate: '2023-11-18',
    status: 'pending',
    category: 'cleaning',
    rotationEnabled: true,
    difficulty: 'medium',
    estimatedTime: 30, // minutes
    icon: 'restaurant-outline',
    repeatFrequency: 'weekly',
    rotationMembers: ['You', 'Alex', 'Jordan'],
    completionHistory: [
      { date: '2023-11-11', status: 'completed', completedBy: 'Jordan', rating: 'good' },
      { date: '2023-11-04', status: 'completed', completedBy: 'Alex', rating: 'poor' },
    ]
  },
  {
    id: '2',
    title: 'Bathroom Cleaning',
    description: 'Clean shower, toilet, and sink',
    assignedTo: 'Alex',
    dueDate: '2023-11-17',
    status: 'completed',
    category: 'cleaning',
    rotationEnabled: true,
    difficulty: 'hard',
    estimatedTime: 45, // minutes
    icon: 'water-outline',
    repeatFrequency: 'weekly',
    rotationMembers: ['You', 'Alex', 'Jordan'],
    completionHistory: [
      { date: '2023-11-10', status: 'completed', completedBy: 'Alex', rating: 'excellent' },
      { date: '2023-11-03', status: 'missed', assignedTo: 'You', rating: null },
    ]
  },
  {
    id: '3',
    title: 'Living Room',
    description: 'Vacuum floor and dust surfaces',
    assignedTo: 'Jordan',
    dueDate: '2023-11-20',
    status: 'pending',
    category: 'cleaning',
    rotationEnabled: true,
    difficulty: 'medium',
    estimatedTime: 25, // minutes
    icon: 'home-outline',
    repeatFrequency: 'weekly',
    rotationMembers: ['You', 'Alex', 'Jordan'],
    completionHistory: [
      { date: '2023-11-13', status: 'completed', completedBy: 'Jordan', rating: 'good' },
    ]
  },
  {
    id: '4',
    title: 'Cooking Dinner',
    description: 'Prepare dinner for everyone',
    assignedTo: 'You',
    dueDate: '2023-11-18',
    status: 'pending',
    category: 'cooking',
    rotationEnabled: true,
    difficulty: 'hard',
    estimatedTime: 60, // minutes
    icon: 'fast-food-outline',
    repeatFrequency: 'daily',
    rotationMembers: ['You', 'Alex'], // Jordan doesn't cook
    completionHistory: [
      { date: '2023-11-17', status: 'completed', completedBy: 'Alex', rating: 'good' },
      { date: '2023-11-16', status: 'completed', completedBy: 'You', rating: 'excellent' },
    ]
  },
  {
    id: '5',
    title: 'Take Out Trash',
    description: 'Empty all trash bins and take to dumpster',
    assignedTo: 'Alex',
    dueDate: '2023-11-18',
    status: 'pending',
    category: 'cleaning',
    rotationEnabled: true,
    difficulty: 'easy',
    estimatedTime: 10, // minutes
    icon: 'trash-outline',
    repeatFrequency: 'twice-weekly',
    rotationMembers: ['You', 'Alex', 'Jordan'],
    completionHistory: []
  },
];

// Mock data for schedule events
const MOCK_EVENTS = [
  {
    id: '1',
    title: 'House Meeting',
    description: 'Monthly house meeting to discuss issues and plans',
    date: '2023-11-22',
    time: '19:00',
    endTime: '20:00',
    createdBy: 'You',
    attendees: ['You', 'Alex', 'Jordan'],
    recurring: true,
    recurrencePattern: 'monthly',
    location: 'Living Room'
  },
  {
    id: '2',
    title: 'Rent Due',
    description: 'Monthly rent payment',
    date: '2023-11-30',
    time: '00:00',
    endTime: '23:59',
    createdBy: 'System',
    attendees: ['You', 'Alex', 'Jordan'],
    recurring: true,
    recurrencePattern: 'monthly',
    location: null,
    isAllDay: true,
    category: 'payment'
  },
  {
    id: '3',
    title: 'Plumber Visit',
    description: 'Fixing the kitchen sink',
    date: '2023-11-19',
    time: '10:00',
    endTime: '12:00',
    createdBy: 'Alex',
    attendees: ['Alex'],
    recurring: false,
    location: 'Kitchen'
  }
];

// Mock data for swap requests
const MOCK_SWAP_REQUESTS = [
  {
    id: '1',
    taskId: '1',
    requestedBy: 'Alex',
    requestedTo: 'You',
    taskTitle: 'Kitchen Cleaning',
    originalDate: '2023-11-18',
    proposedDate: '2023-11-19',
    message: "I have an appointment on Saturday, could we swap?",
    status: 'pending',
    createdAt: '2023-11-16T14:30:00Z'
  },
  {
    id: '2',
    taskId: '3',
    requestedBy: 'You',
    requestedTo: 'Jordan',
    taskTitle: 'Living Room',
    originalDate: '2023-11-15',
    proposedDate: '2023-11-17',
    message: "Can we swap? I'll be out of town.",
    status: 'accepted',
    createdAt: '2023-11-14T09:15:00Z'
  }
];

// Mock data for user penalty points
const MOCK_PENALTY_POINTS = {
  'You': 0,
  'Alex': 2,
  'Jordan': 1
};

const RULE_CATEGORIES = [
  { id: 'Noise', color: '#9F71ED', icon: 'volume-high-outline' },
  { id: 'Cleanliness', color: '#2EAF89', icon: 'sparkles-outline' },
  { id: 'Guests', color: '#FF9855', icon: 'people-outline' },
  { id: 'Shopping', color: '#546DE5', icon: 'cart-outline' },
  { id: 'Utilities', color: '#EB5982', icon: 'flash-outline' },
  { id: 'Other', color: '#26C6DA', icon: 'ellipsis-horizontal-outline' },
];

const TasksScheduleScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigation = useNavigation();

  // State variables
  const [islandMode, setIslandMode] = useState<IslandMode>('tasks');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'rules'>('tasks');
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [swapRequests, setSwapRequests] = useState(MOCK_SWAP_REQUESTS);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [taskFilter, setTaskFilter] = useState('mine'); // 'mine', 'all', 'upcoming'
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<string>('');
  const [ruleFilter, setRuleFilter] = useState<string | null>(null);
  const [showEditRuleModal, setShowEditRuleModal] = useState<boolean>(false);
  const [ruleToEdit, setRuleToEdit] = useState<HouseRule | null>(null);
  const [editedRule, setEditedRule] = useState({
    title: '',
    description: '',
    category: 'Other'
  });

  // Get user's home ID
  const homeId = user?.user_metadata?.home_id || '';
  
  // Use house rules hook instead of mock data
  const { 
    rules: houseRules, 
    loading: rulesLoading, 
    error: rulesError,
    fetchRules: refreshRules,
    createRule,
    updateRule,
    toggleAgreement,
    addComment,
    deleteRule
  } = useHouseRules(homeId);
  
  // Use home members hook
  const { members, formatMemberName } = useHomeMembers(homeId);
  
  // New state for task and rule creation modals
  const [showNewTaskModal, setShowNewTaskModal] = useState<boolean>(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState<boolean>(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'cleaning',
    assignedTo: 'You',
    icon: 'checkmark-circle-outline',
    rotationEnabled: false,
    rotationMembers: ['You', 'Alex', 'Jordan']
  });
  const [newRule, setNewRule] = useState({
    title: '',
    description: '',
    category: 'Other'
  });

  // Animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerAnimation = useRef(new Animated.Value(0)).current;
  const contentAnimation = useRef(new Animated.Value(0)).current;

  // Animate on mount
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

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshRules();
    await new Promise(resolve => setTimeout(resolve, 1500));
    showNotification('Updated', 'Your tasks and schedule have been refreshed', 'success');
    setRefreshing(false);
  };

  // Handle action button from HomeIsland
  const handleIslandAction = () => {
    if (islandMode === 'tasks') {
      setShowNewTaskModal(true);
    } else {
      showNotification('Schedule', 'Adding a new event to the schedule...', 'info');
    }
  };

  // Handle creating a new task
  const handleCreateTask = () => {
    if (!newTask.title) {
      showNotification('Error', 'Please provide a task title', 'error');
      return;
    }

    const newTaskObj = {
      id: `task_${Date.now()}`,
      title: newTask.title,
      description: newTask.description || 'No description provided',
      assignedTo: newTask.assignedTo,
      dueDate: newTask.dueDate,
      status: 'pending',
      category: newTask.category,
      rotationEnabled: newTask.rotationEnabled,
      icon: newTask.icon,
      repeatFrequency: 'weekly',
      difficulty: 'medium',
      estimatedTime: 30,
      rotationMembers: newTask.rotationMembers,
      completionHistory: []
    };

    setTasks([newTaskObj, ...tasks]);
    setShowNewTaskModal(false);
    setNewTask({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      category: 'cleaning',
      assignedTo: 'You',
      icon: 'checkmark-circle-outline',
      rotationEnabled: false,
      rotationMembers: ['You', 'Alex', 'Jordan']
    });
    showNotification('Success', 'New task has been created', 'success');
  };

  // Handle creating a new house rule - updated to use createRule from hook
  const handleCreateRule = async () => {
    if (!newRule.title || !newRule.description) {
      showNotification('Error', 'Please fill in all required fields', 'error');
      return;
    }
    
    let targetHomeId = homeId;
    
    if (!targetHomeId && user?.id) {
      try {
        const membership = await fetchUserHomeMembership(user.id);
        if (membership && membership.home_id) {
          targetHomeId = membership.home_id;
        } else {
          showNotification('Error', 'You need to be a member of a home to create rules', 'error');
          return;
        }
      } catch (error) {
        showNotification('Error', 'Failed to verify home membership', 'error');
        return;
      }
    }
    
    if (!targetHomeId) {
      showNotification('Error', 'Home ID is missing. Cannot create rule.', 'error');
      return;
    }
    
    try {
      const result = await createRule(
        {
          title: newRule.title,
          description: newRule.description,
          category: newRule.category
        },
        targetHomeId
      );
      
      if (result) {
        setShowNewRuleModal(false);
        setNewRule({
          title: '',
          description: '',
          category: 'Other'
        });
      }
    } catch (error: any) {
      showNotification('Error', `Failed to create rule: ${error.message}`, 'error');
    }
  };

  // Handle agreement toggle for rules - updated to use toggleAgreement from hook
  const handleRuleAgreement = async (ruleId: string) => {
    try {
      await toggleAgreement(ruleId);
    } catch (error: any) {
      showNotification('Error', `Failed to update agreement: ${error.message}`, 'error');
    }
  };

  // Handle adding comment to a rule - updated to use addComment from hook
  const handleAddComment = async (ruleId: string) => {
    if (!newComment.trim()) return;
    
    try {
      await addComment(ruleId, newComment.trim());
      setNewComment('');
    } catch (error: any) {
      showNotification('Error', `Failed to add comment: ${error.message}`, 'error');
    }
  };

  // Handle editing a rule - updated to use updateRule from hook
  const handleEditRule = async () => {
    if (!ruleToEdit || !ruleToEdit.id || !editedRule) {
      showNotification('Error', 'Invalid rule data', 'error');
      return;
    }
    
    try {
      const result = await updateRule(ruleToEdit.id, {
        title: editedRule.title,
        description: editedRule.description,
        category: editedRule.category
      });
      
      if (result) {
        setShowEditRuleModal(false);
        setRuleToEdit(null);
        showNotification('Success', 'Rule updated successfully', 'success');
      }
    } catch (error: any) {
      showNotification('Error', `Failed to update rule: ${error.message}`, 'error');
    }
  };

  // Handle initiating rule deletion with confirmation
  const handleDeleteRule = (ruleId: string) => {
    Alert.alert(
      "Delete Rule",
      "Are you sure you want to delete this rule? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const success = await deleteRule(ruleId);
            if (success) {
              showNotification('Success', 'Rule deleted successfully', 'success');
            } else {
              showNotification('Error', 'Failed to delete rule', 'error');
            }
          }
        }
      ]
    );
  };

  // Render the Tasks tab content with integrated schedule
  const renderTasksTab = () => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const selectedDateEvents = events.filter(event => event.date === selectedDateStr);
    const filteredTasks = tasks.filter(task => {
      if (taskFilter === 'mine') return task.assignedTo === 'You';
      return true;
    });

    return (
      <View style={styles.tabContent}>
        {/* Calendar View */}
        <View style={styles.calendarContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 10 }]}>
            Schedule
          </Text>
          <View style={styles.calendarPlaceholder}>
            <Text style={[styles.placeholderText, { color: theme.colors.text }]}>
              Week of {selectedDate.toLocaleDateString()}
            </Text>
            <View style={styles.daysRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <TouchableOpacity 
                  key={day} 
                  style={[
                    styles.dayButton,
                    i === selectedDate.getDay() && {
                      backgroundColor: theme.colors.primary + '20',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  onPress={() => {
                    const newDate = new Date();
                    newDate.setDate(newDate.getDate() - newDate.getDay() + i);
                    setSelectedDate(newDate);
                  }}
                >
                  <Text style={[
                    styles.dayButtonText, 
                    i === selectedDate.getDay() && { color: theme.colors.primary, fontWeight: '700' }
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        
        {/* Events for selected date */}
        {selectedDateEvents.length > 0 && (
          <View style={styles.selectedDateEventsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {selectedDate.toDateString() === new Date().toDateString() ? "Today's Events" : `Events for ${selectedDate.toLocaleDateString()}`}
              </Text>
              <TouchableOpacity onPress={() => showNotification('Add Event', 'Creating a new event...', 'info')}>
                <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            {selectedDateEvents.map(event => renderEventItem(event))}
          </View>
        )}

        {/* Task Filters */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Tasks
          </Text>
          <TouchableOpacity onPress={() => setShowNewTaskModal(true)}>
            <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              taskFilter === 'mine' && styles.activeFilterButton,
              { backgroundColor: taskFilter === 'mine' ? theme.colors.primary : 'rgba(150, 150, 150, 0.1)' }
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
              { backgroundColor: taskFilter === 'all' ? theme.colors.primary : 'rgba(150, 150, 150, 0.1)' }
            ]}
            onPress={() => setTaskFilter('all')}
          >
            <Text style={[styles.filterText, { color: taskFilter === 'all' ? '#fff' : theme.colors.text }]}>
              All Tasks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              taskFilter === 'upcoming' && styles.activeFilterButton,
              { backgroundColor: taskFilter === 'upcoming' ? theme.colors.primary : 'rgba(150, 150, 150, 0.1)' }
            ]}
            onPress={() => setTaskFilter('upcoming')}
          >
            <Text style={[styles.filterText, { color: taskFilter === 'upcoming' ? '#fff' : theme.colors.text }]}>
              Upcoming
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tasks List */}
        <View style={styles.taskListContainer}>
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="checkmark-circle-outline" size={60} color="rgba(150, 150, 150, 0.5)" />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No tasks to display
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {taskFilter === 'mine' ? "You have no tasks assigned to you" : "No tasks found"}
              </Text>
            </View>
          ) : (
            filteredTasks.map(task => renderTaskItem(task))
          )}
        </View>

        {/* Swap Requests Section */}
        {filteredTasks.length > 0 && (
          <View style={styles.swapRequestsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Swap Requests
              </Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {swapRequests.filter(req => req.requestedTo === 'You' && req.status === 'pending').length === 0 ? (
              <Text style={styles.noSwapRequestsText}>No pending swap requests</Text>
            ) : (
              swapRequests
                .filter(req => req.requestedTo === 'You' && req.status === 'pending')
                .map(request => renderSwapRequestItem(request))
            )}
          </View>
        )}
      </View>
    );
  };

  // Render an individual task item
  const renderTaskItem = (task: any) => {
    const isMyTask = task.assignedTo === 'You';
    const isPending = task.status === 'pending';
    const isCompleted = task.status === 'completed';
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return (
      <View 
        key={task.id}
        style={[
          styles.taskCard,
          { backgroundColor: theme.colors.card }
        ]}
      >
        {/* Task Header */}
        <View style={styles.taskHeader}>
          <View style={[
            styles.taskIconContainer,
            { backgroundColor: isCompleted ? 'rgba(46, 175, 137, 0.1)' : 'rgba(84, 109, 229, 0.1)' }
          ]}>
            <Ionicons
              name={task.icon || 'checkmark-circle-outline'}
              size={20}
              color={isCompleted ? '#2EAF89' : '#546DE5'}
            />
          </View>
          <View style={styles.taskTitleContainer}>
            <Text style={[
              styles.taskTitle,
              isCompleted && styles.completedTaskTitle,
              { color: theme.colors.text }
            ]}>
              {task.title}
            </Text>
            <Text style={styles.taskDueDate}>
              {daysRemaining === 0 ? 'Due today' : 
                daysRemaining < 0 ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}` : 
                `Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
            </Text>
          </View>
          <View style={styles.taskAssigneeContainer}>
            <Text style={[
              styles.taskAssignee,
              isMyTask && styles.myTaskLabel,
              { color: isMyTask ? '#546DE5' : theme.colors.text }
            ]}>
              {isMyTask ? 'You' : task.assignedTo}
            </Text>
          </View>
        </View>

        {/* Task Actions */}
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
                <Text style={styles.actionButtonText}>Request Swap</Text>
              </TouchableOpacity>
            </>
          )}
          {!isMyTask && isCompleted && (
            <TouchableOpacity 
              style={[styles.taskActionButton, styles.evaluateButton]}
              onPress={() => handleEvaluateTask(task.id)}
            >
              <Ionicons name="star-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Evaluate</Text>
            </TouchableOpacity>
          )}
          {isCompleted && (
            <View style={styles.completedStatusContainer}>
              <Ionicons name="checkmark-circle" size={18} color="#2EAF89" />
              <Text style={styles.completedStatusText}>
                Completed by {task.assignedTo}
              </Text>
            </View>
          )}
        </View>

        {/* Rotation Info */}
        {task.rotationEnabled && (
          <View style={styles.rotationInfo}>
            <Ionicons name="repeat" size={14} color="#999" />
            <Text style={styles.rotationText}>
              Rotates {task.repeatFrequency} between {task.rotationMembers.join(', ')}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render a swap request item
  const renderSwapRequestItem = (request: any) => {
    return (
      <View key={request.id} style={[styles.swapRequestCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.swapRequestInfo}>
          <Text style={[styles.swapRequestTitle, { color: theme.colors.text }]}>
            {request.requestedBy} wants to swap "{request.taskTitle}"
          </Text>
          <Text style={styles.swapRequestDetails}>
            From {new Date(request.originalDate).toLocaleDateString()} to {new Date(request.proposedDate).toLocaleDateString()}
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
            onPress={() => {
              showNotification('Swap Accepted', `You've agreed to swap with ${request.requestedBy}`, 'success');
              setSwapRequests(prev => prev.map(r => r.id === request.id ? {...r, status: 'accepted'} : r));
            }}
          >
            <Text style={styles.swapActionButtonText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.swapActionButton, styles.rejectButton]}
            onPress={() => {
              showNotification('Swap Declined', `You've declined the swap request from ${request.requestedBy}`, 'info');
              setSwapRequests(prev => prev.map(r => r.id === request.id ? {...r, status: 'rejected'} : r));
            }}
          >
            <Text style={styles.swapActionButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render an individual event item
  const renderEventItem = (event: any) => {
    const getEventTypeColor = () => {
      if (event.category === 'payment') return '#EB4D4B';
      if (event.title.toLowerCase().includes('meeting')) return '#546DE5';
      return '#F7B731';
    };
    
    return (
      <View 
        key={event.id}
        style={[styles.eventCard, { backgroundColor: theme.colors.card }]}
      >
        <View style={[styles.eventColorIndicator, { backgroundColor: getEventTypeColor() }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
              {event.title}
            </Text>
            {event.recurring && (
              <View style={styles.recurringBadge}>
                <Ionicons name="repeat" size={12} color="#546DE5" />
                <Text style={styles.recurringText}>{event.recurrencePattern}</Text>
              </View>
            )}
          </View>
          <View style={styles.eventDetails}>
            <View style={styles.eventDetailItem}>
              <Ionicons name="time-outline" size={14} color="#999" />
              <Text style={styles.eventDetailText}>
                {event.isAllDay ? 'All day' : `${event.time}${event.endTime ? ' - ' + event.endTime : ''}`}
              </Text>
            </View>
            {event.location && (
              <View style={styles.eventDetailItem}>
                <Ionicons name="location-outline" size={14} color="#999" />
                <Text style={styles.eventDetailText}>
                  {event.location}
                </Text>
              </View>
            )}
            <View style={styles.eventDetailItem}>
              <Ionicons name="person-outline" size={14} color="#999" />
              <Text style={styles.eventDetailText}>
                {event.createdBy === 'System' ? 'Automatic' : `Created by ${event.createdBy}`}
              </Text>
            </View>
          </View>
          {event.description && (
            <Text style={styles.eventDescription}>
              {event.description}
            </Text>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <View style={styles.attendeesContainer}>
              <Text style={styles.attendeesLabel}>
                {event.attendees.length} {event.attendees.length === 1 ? 'Person' : 'People'} Involved:
              </Text>
              <Text style={styles.attendeesList}>
                {event.attendees.join(', ')}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render the Rules tab content - updated to use real data
  const renderRulesTab = () => {
    const filteredRules = ruleFilter 
      ? houseRules.filter(rule => rule.category === ruleFilter)
      : houseRules;
      
    return (
      <View style={styles.tabContent}>
        {/* Rule Categories Filter */}
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
                {color: !ruleFilter ? '#fff' : isDarkMode ? '#999' : '#666'}
              ]}
            >
              All Rules
            </Text>
          </TouchableOpacity>
          {RULE_CATEGORIES.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryFilterButton,
                ruleFilter === category.id && styles.activeCategoryFilter,
                { backgroundColor: ruleFilter === category.id ? category.color : 'rgba(150, 150, 150, 0.1)' }
              ]}
              onPress={() => setRuleFilter(prev => prev === category.id ? null : category.id)}
            >
              <Ionicons 
                name={category.icon} 
                size={16} 
                color={ruleFilter === category.id ? '#fff' : category.color} 
              />
              <Text 
                style={[
                  styles.categoryFilterText, 
                  {color: ruleFilter === category.id ? '#fff' : category.color}
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
          <Text style={[styles.sectionLabel, { color: isDarkMode ? '#999' : '#666' }]}>
            {filteredRules.length} House Rules
          </Text>
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
                {ruleFilter ? `No ${ruleFilter} rules exist yet` : "Create your first house rule to get started"}
              </Text>
            </View>
          ) : (
            filteredRules.map(rule => renderRuleItem(rule))
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

  // Render an individual rule item - updated to include edit/delete options
  const renderRuleItem = (rule: HouseRule) => {
    const category = RULE_CATEGORIES.find(cat => cat.id === rule.category);
    const isExpanded = expandedRule === rule.id;
    const hasAgreed = user && rule.agreements?.some(a => a.user_id === user.id);
    const isCreator = user && rule.created_by === user.id;
    
    return (
      <View 
        key={createStableKey(rule.id, 'rule')}
        style={[
          styles.ruleCard, 
          { backgroundColor: theme.colors.card }
        ]}
      >
        <TouchableOpacity 
          style={styles.ruleHeader}
          onPress={() => setExpandedRule(isExpanded ? null : rule.id)}
        >
          <View style={[
            styles.ruleCategoryBadge,
            { backgroundColor: category ? `${category.color}20` : '#26C6DA20' }
          ]}>
            <Ionicons
              name={category?.icon || 'ellipsis-horizontal-outline'}
              size={16}
              color={category?.color || '#26C6DA'}
            />
          </View>
          <View style={styles.ruleTitleContainer}>
            <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>
              {rule.title}
            </Text>
            <Text style={styles.ruleInfo}>
              Added by {rule.creator_name || 'Unknown'} • 
              {rule.agreements ? `${rule.agreements.length} ${rule.agreements.length === 1 ? 'person' : 'people'} agreed` : 'No agreements yet'}
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
                  <Ionicons name="pencil-outline" size={18} color={isDarkMode ? '#999' : '#666'} />
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
              <Text style={[styles.ruleAgreementLabel, { color: isDarkMode ? '#999' : '#666' }]}>
                Agreements:
              </Text>
              <View style={styles.ruleAgreementList}>
                {members.map(member => {
                  const hasAgreed = rule.agreements?.some(a => a.user_id === member.user_id);
                  const isCurrentUser = user && member.user_id === user.id;
                  return (
                    <View 
                      key={member.user_id}
                      style={[
                        styles.ruleAgreementBadge,
                        hasAgreed ? 
                          { backgroundColor: '#2EAF8920', borderColor: '#2EAF89' } : 
                          { backgroundColor: 'rgba(150, 150, 150, 0.1)', borderColor: 'rgba(150, 150, 150, 0.2)' }
                      ]}
                    >
                      <Text 
                        style={[
                          styles.ruleAgreementPerson,
                          { color: hasAgreed ? '#2EAF89' : '#999' }
                        ]}
                      >
                        {isCurrentUser ? 'You' : member.full_name}
                      </Text>
                      {hasAgreed && (
                        <Ionicons name="checkmark" size={12} color="#2EAF89" style={styles.ruleCheckIcon} />
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
                      { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }
                    ]}
                  >
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUserContainer}>
                        <UserAvatar 
                          isCurrentUser={comment.user_id === user?.id}
                          name={comment.user_name || 'Unknown'}
                        />
                        <Text style={[
                          styles.commentUser, 
                          { color: comment.user_id === user?.id ? theme.colors.primary : theme.colors.text }
                        ]}>
                          {comment.user_id === user?.id ? 'You' : comment.user_name}
                        </Text>
                      </View>
                      <Text style={styles.commentTime}>
                        {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                  { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }
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
                  !newComment.trim() && { opacity: 0.6 }
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
                hasAgreed ? 
                  { backgroundColor: 'rgba(150, 150, 150, 0.1)' } : 
                  { backgroundColor: '#2EAF8920' }
              ]}
              onPress={() => handleRuleAgreement(rule.id)}
            >
              <Text style={[
                styles.toggleAgreementText,
                { color: hasAgreed ? isDarkMode ? '#999' : '#666' : '#2EAF89' }
              ]}>
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

  // Render the New Task Modal
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
                Create New Task
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
                style={[styles.textInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                placeholder="Enter task title"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newTask.title}
                onChangeText={(text) => setNewTask({...newTask, title: text})}
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textAreaInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                placeholder="Enter task description"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newTask.description}
                onChangeText={(text) => setNewTask({...newTask, description: text})}
                multiline
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Due Date</Text>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newTask.dueDate}
                onChangeText={(text) => setNewTask({...newTask, dueDate: text})}
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Category</Text>
              <View style={styles.categoriesContainer}>
                {['cleaning', 'cooking', 'shopping', 'maintenance', 'other'].map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryOption,
                      newTask.category === category && styles.activeCategoryOption
                    ]}
                    onPress={() => setNewTask({...newTask, category})}
                  >
                    <Text 
                      style={[
                        styles.categoryOptionText, 
                        {color: newTask.category === category ? theme.colors.primary : isDarkMode ? '#999' : '#666'}
                      ]}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Assigned To</Text>
              <View style={styles.assigneeContainer}>
                {['You', 'Alex', 'Jordan'].map((person) => (
                  <TouchableOpacity
                    key={person}
                    style={[
                      styles.assigneeOption,
                      newTask.assignedTo === person && styles.activeAssigneeOption
                    ]}
                    onPress={() => setNewTask({...newTask, assignedTo: person})}
                  >
                    <Text 
                      style={[
                        styles.assigneeOptionText, 
                        {color: newTask.assignedTo === person ? '#fff' : isDarkMode ? '#999' : '#666'}
                      ]}
                    >
                      {person}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.rotationToggleContainer}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Enable Rotation</Text>
                <Switch
                  value={newTask.rotationEnabled}
                  onValueChange={(value) => setNewTask({...newTask, rotationEnabled: value})}
                  trackColor={{ false: '#767577', true: theme.colors.primary + '70' }}
                  thumbColor={newTask.rotationEnabled ? theme.colors.primary : '#f4f3f4'}
                />
              </View>
              {newTask.rotationEnabled && (
                <View style={styles.rotationMembersContainer}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Rotation Members</Text>
                  {['You', 'Alex', 'Jordan'].map((person) => (
                    <View key={person} style={styles.rotationMemberRow}>
                      <Text style={{color: theme.colors.text}}>{person}</Text>
                      <Switch
                        value={newTask.rotationMembers.includes(person)}
                        onValueChange={(value) => {
                          if (value) {
                            setNewTask({...newTask, rotationMembers: [...newTask.rotationMembers, person]});
                          } else {
                            setNewTask({
                              ...newTask, 
                              rotationMembers: newTask.rotationMembers.filter(p => p !== person)
                            });
                          }
                        }}
                        trackColor={{ false: '#767577', true: theme.colors.primary + '70' }}
                        thumbColor={newTask.rotationMembers.includes(person) ? theme.colors.primary : '#f4f3f4'}
                      />
                    </View>
                  ))}
                </View>
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
                style={[styles.modalActionButton, styles.confirmButton, !newTask.title && styles.disabledButton]}
                onPress={handleCreateTask}
                disabled={!newTask.title}
              >
                <Text style={styles.confirmButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Render the New Rule Modal
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

  // Render the Edit Rule Modal
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <LinearGradient
        colors={[
          isDarkMode ? 'rgba(84, 109, 229, 0.15)' : 'rgba(84, 109, 229, 0.08)',
          isDarkMode ? 'rgba(84, 109, 229, 0.05)' : 'rgba(84, 109, 229, 0.02)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={styles.headerGradient}
      />
      <View style={styles.islandContainer}>
        <HomeIsland
          mode={islandMode}
          onModeChange={setIslandMode}
          onActionPress={handleIslandAction}
          navigation={navigation}
          contextMode="home"
          data={{
            expenses: [],
            tasks: MOCK_TASKS,
            events: MOCK_EVENTS,
            furniture: [],
          }}
        />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#546DE5"
            colors={['#546DE5']}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnimation,
              transform: [
                {
                  translateY: headerAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {activeTab === 'tasks' ? 'Tasks & Schedule' : 'House Rules'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {activeTab === 'tasks' 
                ? 'Manage your household tasks and schedule'
                : 'Establish and manage house rules'}
            </Text>
          </View>
          {MOCK_PENALTY_POINTS['You'] > 0 && (
            <View style={styles.penaltyBadge}>
              <Ionicons name="alert-circle" size={16} color="#EB4D4B" />
              <Text style={styles.penaltyText}>
                {MOCK_PENALTY_POINTS['You']} Penalty {MOCK_PENALTY_POINTS['You'] === 1 ? 'Point' : 'Points'}
              </Text>
            </View>
          )}
        </Animated.View>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'tasks' && styles.activeTabButton,
              { borderBottomColor: activeTab === 'tasks' ? theme.colors.primary : 'transparent' }
            ]}
            onPress={() => setActiveTab('tasks')}
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color={activeTab === 'tasks' ? theme.colors.primary : '#999'}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'tasks' ? theme.colors.primary : '#999',
                  fontWeight: activeTab === 'tasks' ? '600' : '400'
                }
              ]}
            >
              Tasks & Schedule
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'rules' && styles.activeTabButton,
              { borderBottomColor: activeTab === 'rules' ? theme.colors.primary : 'transparent' }
            ]}
            onPress={() => setActiveTab('rules')}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color={activeTab === 'rules' ? theme.colors.primary : '#999'}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'rules' ? theme.colors.primary : '#999',
                  fontWeight: activeTab === 'rules' ? '600' : '400'
                }
              ]}
            >
              Rules
            </Text>
          </TouchableOpacity>
        </View>
        <Animated.View
          style={[
            styles.tabContentContainer,
            {
              opacity: contentAnimation,
              transform: [
                {
                  translateY: contentAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {activeTab === 'tasks' ? renderTasksTab() : renderRulesTab()}
        </Animated.View>
      </ScrollView>
      {renderNewTaskModal()}
      {renderNewRuleModal()}
      {renderEditRuleModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 300,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 130 : 110,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  islandContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 90,
    left: 0,
    right: 0,
    zIndex: 50,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
  },
  penaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(235, 77, 75, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  penaltyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EB4D4B',
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  activeTabButton: {
    borderBottomWidth: 2,
  },
  tabButtonText: {
    fontSize: 16,
    marginLeft: 8,
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 12,
  },
  activeFilterButton: {
    backgroundColor: '#546DE5',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  taskListContainer: {
    marginBottom: 20,
  },
  taskCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskTitleContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  completedTaskTitle: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskDueDate: {
    fontSize: 13,
    color: '#999',
  },
  taskAssigneeContainer: {
    marginLeft: 8,
  },
  taskAssignee: {
    fontSize: 14,
    fontWeight: '500',
  },
  myTaskLabel: {
    color: '#546DE5',
    fontWeight: '700',
  },
  taskActions: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
  },
  taskActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  completeButton: {
    backgroundColor: '#2EAF89',
  },
  swapButton: {
    backgroundColor: '#F7B731',
  },
  evaluateButton: {
    backgroundColor: '#9B59B6',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 6,
  },
  completedStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedStatusText: {
    fontSize: 13,
    color: '#2EAF89',
    marginLeft: 4,
  },
  rotationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  rotationText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    color: '#546DE5',
  },
  swapRequestsContainer: {
    marginBottom: 24,
  },
  swapRequestCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  swapRequestInfo: {
    marginBottom: 12,
  },
  swapRequestTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  swapRequestDetails: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
  },
  swapRequestMessage: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  swapRequestMessageText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#777',
  },
  swapRequestActions: {
    flexDirection: 'row',
  },
  swapActionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginRight: 10,
  },
  acceptButton: {
    backgroundColor: '#2EAF89',
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  swapActionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  noSwapRequestsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  preferencesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  preferencesButtonText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  calendarContainer: {
    marginBottom: 20,
  },
  calendarPlaceholder: {
    height: 80,
    marginBottom: 16,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayButtonText: {
    fontSize: 12,
    color: '#999',
  },
  selectedDateEventsContainer: {
    marginBottom: 24,
  },
  eventCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  eventColorIndicator: {
    width: 6,
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(84, 109, 229, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  recurringText: {
    fontSize: 10,
    color: '#546DE5',
    marginLeft: 3,
  },
  eventDetails: {
    marginBottom: 8,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
  },
  eventDescription: {
    fontSize: 14,
    color: '#777',
    marginBottom: 8,
  },
  attendeesContainer: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 8,
    padding: 10,
  },
  attendeesLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#777',
    marginBottom: 4,
  },
  attendeesList: {
    fontSize: 13,
    color: '#555',
  },
  ruleCategoriesContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingRight: 16,
  },
  categoryFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  activeCategoryFilter: {
    backgroundColor: '#546DE5',
  },
  categoryFilterText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  rulesSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  ruleSummaryCard: {
    width: '31%',
    height: 70,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  ruleSummaryNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#546DE5',
    marginBottom: 4,
  },
  ruleSummaryLabel: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  ruleListContainer: {
    marginBottom: 20,
  },
  ruleCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  ruleCategoryBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ruleTitleContainer: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  ruleInfo: {
    fontSize: 12,
    color: '#999',
  },
  ruleActions: {
    padding: 4,
  },
  ruleActionButtons: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ruleActionButton: {
    padding: 5,
    marginLeft: 4,
  },
  ruleDetails: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  ruleDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  ruleAgreementStatus: {
    marginBottom: 16,
  },
  ruleAgreementLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  ruleAgreementList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ruleAgreementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  ruleAgreementPerson: {
    fontSize: 12,
    fontWeight: '500',
  },
  ruleCheckIcon: {
    marginLeft: 4,
  },
  ruleCommentsContainer: {
    marginBottom: 16,
  },
  ruleCommentsTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  commentItem: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 11,
    color: '#999',
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    maxHeight: 80,
  },
  commentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  toggleAgreementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  toggleAgreementText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  createRuleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  createRuleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '95%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalScrollContent: {
    maxHeight: 450,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 15,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  categoryOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  activeCategoryOption: {
    backgroundColor: 'rgba(84, 109, 229, 0.2)',
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  assigneeContainer: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  assigneeOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  activeAssigneeOption: {
    backgroundColor: '#546DE5',
  },
  assigneeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rotationToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  rotationMembersContainer: {
    marginVertical: 8,
  },
  rotationMemberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalActionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: '#546DE5',
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  ruleCategoriesSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  ruleCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ruleCategoryIcon: {
    marginRight: 4,
  },
  ruleCategoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TasksScheduleScreen;
