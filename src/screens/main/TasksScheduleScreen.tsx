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
    proposedDate: new Date().toISOString().split('T')[0],
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

  const isMemberAvailable = (userId: string, dayOfWeek: string, timeSlot: string): boolean => {
    const availability = membersAvailability[userId];
    return isUserAvailableAt(availability, dayOfWeek, timeSlot);
  };

  useEffect(() => {
    if (showNewTaskModal && members && members.length > 0) {
      fetchMembersAvailability();
    }
  }, [showNewTaskModal, members, fetchMembersAvailability]);

  const handleCreateTask = async () => {
    if (!newTask.title) {
      showNotification('Error', 'Please enter a task title', 'error');
      return;
    }

    if (newTask.assigned_to.length === 0) {
      showNotification('Error', 'Please assign the task to at least one person', 'error');
      return;
    }

    const defaultCategory = 'other';
    const defaultIcon = 'checkmark-circle-outline';

    const dueDate = getDateFromDayOfWeek(newTask.day_of_week);

    try {
      for (const assigneeId of newTask.assigned_to) {
        const taskData = {
          title: newTask.title,
          description: newTask.description,
          category: defaultCategory,
          icon: defaultIcon,
          due_date: dueDate,
          day_of_week: newTask.day_of_week,
          time_slot: newTask.time_slot,
          assigned_to: assigneeId,
          rotation_enabled: newTask.rotationEnabled,
          rotation_members: newTask.rotationMembers.length > 0 
            ? newTask.rotationMembers 
            : undefined,
          repeat_frequency: newTask.rotationEnabled ? newTask.rotationFrequency : undefined,
        };

        await createTask(taskData);
      }

      setShowNewTaskModal(false);
      showNotification(
        'Success', 
        `Task${newTask.assigned_to.length > 1 ? 's' : ''} created successfully`, 
        'success'
      );

      setNewTask({
        title: '',
        description: '',
        day_of_week: 'mon',
        time_slot: 'morning',
        assigned_to: [],
        rotationEnabled: false,
        rotationMembers: [],
        rotationFrequency: 'weekly',
      });

      refreshTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      showNotification('Error', 'Failed to create task', 'error');
    }
  };


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
        proposedDate: new Date().toISOString().split('T')[0],
        message: '',
      });
      setShowSwapRequestModal(true);
    }
  };

  const submitSwapRequest = async () => {
    if (!taskToSwap || !swapRequest.requestedTo || !swapRequest.proposedDate) {
      showNotification('Error', 'Please fill in all required fields', 'error');
      return;
    }

    try {
      await requestSwap(
        taskToSwap.id,
        swapRequest.requestedTo,
        taskToSwap.due_date || '',
        swapRequest.proposedDate,
        swapRequest.message
      );

      setShowSwapRequestModal(false);
      setTaskToSwap(null);
    } catch (error) {
      showNotification('Error', 'Failed to submit swap request', 'error');
    }
  };

  const handleSwapResponse = async (swapRequestId: string, accept: boolean) => {
    try {
      await respondToSwap(swapRequestId, accept);
    } catch (error) {
      showNotification('Error', 'Failed to respond to swap request', 'error');
    }
  };

  const getFilteredTasks = () => {
    return tasks.filter((task) => {
      const taskDate = task.due_date ? task.due_date.split('T')[0] : '';
      const matchesSelectedDay = taskDate === selectedDay;

      if (!matchesSelectedDay) return false;

      if (taskFilter === 'mine') {
        return task.assigned_to === user?.id;
      }
      if (taskFilter === 'upcoming') {
        const dueDate = new Date(task.due_date || '');
        const today = new Date();
        const inNextThreeDays =
          dueDate >= today &&
          dueDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        return inNextThreeDays;
      }
      return true;
    });
  };

  const getPendingSwapRequests = () => {
    return swapRequests.filter(
      (req) => req.requested_to === user?.id && req.status === 'pending'
    );
  };

  const renderWeeklyCalendar = () => {
    return (
      <View style={styles.weeklyCalendarContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 10 }]}>
          Weekly Schedule
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={daysOfWeek}
          keyExtractor={(item) => item.dateStr}
          renderItem={({ item }) => {
            const isSelected = selectedDay === item.dateStr;

            const dayTasks = tasks.filter(
              (task) => task.due_date && task.due_date.split('T')[0] === item.dateStr
            );

            const myTasks = dayTasks.filter((task) => task.assigned_to === user?.id);

            return (
              <TouchableOpacity
                style={[
                  styles.dayCard,
                  item.isToday && styles.todayCard,
                  isSelected && styles.selectedDayCard,
                  { backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.card },
                ]}
                onPress={() => setSelectedDay(item.dateStr)}
              >
                <Text
                  style={[
                    styles.dayName,
                    isSelected && { color: theme.colors.primary, fontWeight: '700' },
                  ]}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.dayDate,
                    isSelected && { color: theme.colors.primary },
                  ]}
                >
                  {item.date.getDate()}
                </Text>

                {myTasks.length > 0 && (
                  <View
                    style={[
                      styles.taskCountBadge,
                      { backgroundColor: isSelected ? theme.colors.primary : '#FF9855' },
                    ]}
                  >
                    <Text style={styles.taskCountText}>{myTasks.length}</Text>
                  </View>
                )}

                {dayTasks.length > 0 && myTasks.length === 0 && (
                  <View
                    style={[
                      styles.allTasksCountBadge,
                      { backgroundColor: isSelected ? theme.colors.primary + '80' : '#bbb' },
                    ]}
                  >
                    <Text style={styles.taskCountText}>{dayTasks.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.calendarList}
        />
      </View>
    );
  };

  const renderTasksTab = () => {
    const filteredTasks = getFilteredTasks();
    const pendingSwapRequests = getPendingSwapRequests();

    const selectedDateObj = new Date(selectedDay);
    const formattedDate = selectedDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    const isToday = selectedDateObj.toDateString() === new Date().toDateString();

    return (
      <View style={styles.tabContent}>
        {renderWeeklyCalendar()}

        <View style={styles.selectedDayHeader}>
          <Text style={[styles.selectedDayText, { color: theme.colors.text }]}>
            {isToday ? "Today's Tasks" : `Tasks for ${formattedDate}`}
          </Text>
          <TouchableOpacity
            style={[styles.addTaskButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setNewTask((prev) => ({ ...prev, day_of_week: selectedDay }));
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
                  ? `You have no tasks assigned for ${isToday ? 'today' : formattedDate}`
                  : `No tasks scheduled for ${isToday ? 'today' : formattedDate}`}
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
    const isMyTask = task.assigned_to === user?.id;
    const isPending = task.status === 'pending';
    const isCompleted = task.status === 'completed';

    const assignedMember = members.find((m) => m.user_id === task.assigned_to);
    const assignedName = assignedMember ? assignedMember.full_name : 'Unknown';

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
              name={assignedName}
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
              {isMyTask ? 'You' : assignedName}
            </Text>
          </View>
        </View>

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
                Assign To (Select multiple if needed)
              </Text>
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
            tasks,
            events: [],
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
              Chores & Rules
            </Text>
            <Text style={styles.headerSubtitle}>
              Manage household tasks and rules
            </Text>
          </View>
          {calculatePenaltyPoints() > 0 && (
            <View style={styles.penaltyBadge}>
              <Ionicons name="alert-circle" size={16} color="#EB4D4B" />
              <Text style={styles.penaltyText}>{calculatePenaltyPoints()} penalty points</Text>
            </View>
          )}
        </Animated.View>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'tasks' && styles.activeTabButton,
              { borderBottomColor: activeTab === 'tasks' ? theme.colors.primary : 'transparent' },
            ]}
            onPress={() => setActiveTab('tasks')}
          >
            <Ionicons
              name="checkbox-outline"
              size={22}
              color={activeTab === 'tasks' ? theme.colors.primary : '#999'}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'tasks' ? theme.colors.primary : '#999',
                  fontWeight: activeTab === 'tasks' ? '600' : '400',
                },
              ]}
            >
              Chores
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'rules' && styles.activeTabButton,
              { borderBottomColor: activeTab === 'rules' ? theme.colors.primary : 'transparent' },
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
                  fontWeight: activeTab === 'rules' ? '600' : '400',
                },
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
      {renderEvaluateTaskModal()}
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
  loadingText: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
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
  taskDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  taskAssigneeContainer: {
    marginLeft: 8,
    alignItems: 'center',
  },
  assigneeName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
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
    fontSize: 18,
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
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  assigneeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  activeAssigneeOption: {
    backgroundColor: '#546DE5',
  },
  assigneeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
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
  weeklyCalendarContainer: {
    marginBottom: 20,
  },
  calendarList: {
    paddingVertical: 8,
  },
  dayCard: {
    width: 60,
    height: 80,
    marginRight: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  todayCard: {
    borderWidth: 1,
    borderColor: '#546DE5',
  },
  selectedDayCard: {
    shadowColor: '#546DE5',
    shadowOpacity: 0.3,
    elevation: 4,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    marginBottom: 5,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  taskCountBadge: {
    position: 'absolute',
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#546DE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allTasksCountBadge: {
    position: 'absolute',
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#bbb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedDayText: {
    fontSize: 18,
    fontWeight: '600',
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  addTaskText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 4,
  },
  taskHeaderBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  categoryColorIndicator: {
    height: 6,
    width: '100%',
  },
  categoryScrollView: {
    marginVertical: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
  },
  categoryChipText: {
    fontSize: 14,
    marginLeft: 6,
  },
  rotationSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  frequencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  frequencyOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  activeFrequencyOption: {
    backgroundColor: '#546DE5',
  },
  frequencyOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rotationMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consequencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  consequenceOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  activeConsequenceOption: {
    backgroundColor: '#546DE5',
  },
  consequenceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  evaluateTaskInfo: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 8,
  },
  evaluateTaskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  evaluateTaskSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  evaluationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
    justifyContent: 'space-between',
  },
  evaluationOption: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
  },
  evaluationOptionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  penaltyText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  consequenceToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgba(235, 77, 75, 0.1)',
    borderRadius: 8,
  },
  dayOfWeekContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  dayOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  activeDayOption: {
    backgroundColor: '#546DE5',
  },
  dayOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  timeSlotContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  timeSlotOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  activeTimeSlotOption: {
    backgroundColor: '#546DE5',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
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

export default TasksScreen;