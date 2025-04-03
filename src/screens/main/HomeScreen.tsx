import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Animated,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { BlurView } from 'expo-blur';
import { logDebug } from '../../utils/DebugHelper';
import { useNotification } from '../../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Mock data for different sections
const mockExpenses = [
  { id: 1, title: 'Internet Bill', amount: 89.99, date: '2023-11-15', paidBy: 'Alex', category: 'utilities' },
  { id: 2, title: 'Grocery Shopping', amount: 124.56, date: '2023-11-12', paidBy: 'You', category: 'groceries' },
  { id: 3, title: 'Water Bill', amount: 45.00, date: '2023-11-10', paidBy: 'Jordan', category: 'utilities' },
];

const mockSanitizationTasks = [
  { id: 1, title: 'Kitchen Cleaning', assignedTo: 'You', dueDate: '2023-11-18', status: 'pending' },
  { id: 2, title: 'Bathroom Cleaning', assignedTo: 'Alex', dueDate: '2023-11-17', status: 'completed' },
  { id: 3, title: 'Living Room', assignedTo: 'Jordan', dueDate: '2023-11-20', status: 'pending' },
];

const mockScheduledTasks = [
  { id: 1, title: 'Plumber Visit', date: '2023-11-19', time: '10:00 AM', createdBy: 'Alex' },
  { id: 2, title: 'Rent Payment', date: '2023-11-30', time: 'All day', createdBy: 'System' },
  { id: 3, title: 'House Meeting', date: '2023-11-22', time: '7:00 PM', createdBy: 'You' },
];

const mockFurniture = [
  { id: 1, title: 'Living Room Couch', owner: 'Alex', sharedWith: ['You', 'Jordan'], value: 899 },
  { id: 2, title: 'Dining Table', owner: 'Jordan', sharedWith: ['You', 'Alex'], value: 650 },
  { id: 3, title: 'Coffee Machine', owner: 'You', sharedWith: ['All'], value: 199 },
];

const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Animation values
  const headerAnimation = useRef(new Animated.Value(0)).current;
  const sectionsAnimation = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  // Animation effects
  useEffect(() => {
    logDebug('HomeScreen mounted');

    // Run animations on mount
    Animated.timing(headerAnimation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Staggered animations for each section
    sectionsAnimation.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: 200 + index * 150,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      logDebug('HomeScreen unmounting');
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    logDebug('HomeScreen refreshing');

    // Simulate data fetching
    await new Promise((resolve) => setTimeout(resolve, 1500));

    showNotification('Updated', 'Your dashboard has been refreshed with the latest data', 'success');
    setRefreshing(false);
  };

  const handleProfilePress = () => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ProfileScreen',
      })
    );
  };

  const renderExpensesSection = () => {
    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: sectionsAnimation[0],
            transform: [
              {
                translateY: sectionsAnimation[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#546DE5' }]}>
              <Ionicons name="card-outline" size={20} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
          </View>
          <TouchableOpacity style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color="#546DE5" />
          </TouchableOpacity>
        </View>

        <View style={styles.expensesContainer}>
          {mockExpenses.map((expense) => (
            <TouchableOpacity key={expense.id} style={styles.expenseCard}>
              <View style={styles.expenseIconContainer}>
                <View
                  style={[
                    styles.expenseIcon,
                    {
                      backgroundColor:
                        expense.category === 'utilities' ? '#5D78FF20' : '#FF985520',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      expense.category === 'utilities' ? 'flash-outline' : 'cart-outline'
                    }
                    size={18}
                    color={expense.category === 'utilities' ? '#5D78FF' : '#FF9855'}
                  />
                </View>
              </View>
              <View style={styles.expenseDetails}>
                <Text style={styles.expenseTitle} numberOfLines={1}>
                  {expense.title}
                </Text>
                <Text style={styles.expenseSubtitle} numberOfLines={1}>
                  Paid by {expense.paidBy} · {expense.date}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>${expense.amount.toFixed(2)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.addButton}>
          <LinearGradient
            colors={['#3a7bd5', '#546DE5', '#778BEB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add-outline" size={22} color="#fff" />
            <Text style={styles.addButtonText}>Add Expense</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSanitizationSection = () => {
    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: sectionsAnimation[1],
            transform: [
              {
                translateY: sectionsAnimation[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#20BF6B' }]}>
              <Ionicons name="water-outline" size={20} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Sanitization</Text>
          </View>
          <TouchableOpacity style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color="#546DE5" />
          </TouchableOpacity>
        </View>

        <View style={styles.taskList}>
          {mockSanitizationTasks.map((task) => (
            <View key={task.id} style={styles.taskItem}>
              <TouchableOpacity
                style={[
                  styles.taskCheckbox,
                  task.status === 'completed' && styles.taskCheckboxCompleted,
                ]}
              >
                {task.status === 'completed' && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </TouchableOpacity>
              <View style={styles.taskContent}>
                <Text
                  style={[
                    styles.taskTitle,
                    task.status === 'completed' && styles.taskTitleCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
                <Text style={styles.taskSubtitle} numberOfLines={1}>
                  Assigned to {task.assignedTo} · Due {task.dueDate}
                </Text>
              </View>
              <TouchableOpacity style={styles.taskMenuButton}>
                <Ionicons name="ellipsis-vertical" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderScheduleSection = () => {
    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: sectionsAnimation[2],
            transform: [
              {
                translateY: sectionsAnimation[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F0932B' }]}>
              <Ionicons name="calendar-outline" size={20} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>
          <TouchableOpacity style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color="#546DE5" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scheduleContainer}
          decelerationRate="fast"
          snapToInterval={160 + 10}
          snapToAlignment="center"
        >
          {mockScheduledTasks.map((event) => (
            <TouchableOpacity key={event.id} style={styles.scheduleCard} activeOpacity={0.9}>
              <View
                style={[
                  styles.scheduleHeader,
                  {
                    backgroundColor: event.title.includes('Rent')
                      ? '#FF636320'
                      : event.title.includes('Meeting')
                      ? '#546DE520'
                      : '#20BF6B20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scheduleDate,
                    {
                      color: event.title.includes('Rent')
                        ? '#FF6363'
                        : event.title.includes('Meeting')
                        ? '#546DE5'
                        : '#20BF6B',
                    },
                  ]}
                >
                  {event.date}
                </Text>
              </View>
              <View style={styles.scheduleBody}>
                <Text style={styles.scheduleTitle} numberOfLines={2} ellipsizeMode="tail">
                  {event.title}
                </Text>
                <Text style={styles.scheduleTime}>{event.time}</Text>
                <Text style={styles.scheduleCreator} numberOfLines={1}>
                  Added by {event.createdBy}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.scheduleAddCard} activeOpacity={0.8}>
            <View style={styles.scheduleAddContent}>
              <View style={styles.scheduleAddIconCircle}>
                <Ionicons name="add" size={28} color="#546DE5" />
              </View>
              <Text style={styles.scheduleAddText}>New Event</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    );
  };

  const renderFurnitureSection = () => {
    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: sectionsAnimation[3],
            transform: [
              {
                translateY: sectionsAnimation[3].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <View style={[styles.sectionIcon, { backgroundColor: '#9B59B6' }]}>
              <Ionicons name="cube-outline" size={20} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>My Furniture</Text>
          </View>
          <TouchableOpacity style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color="#546DE5" />
          </TouchableOpacity>
        </View>

        <View style={styles.furnitureList}>
          {mockFurniture.map((item) => (
            <TouchableOpacity key={item.id} style={styles.furnitureCard} activeOpacity={0.7}>
              <View style={styles.furnitureImageContainer}>
                <View style={styles.furniturePlaceholder}>
                  <Ionicons
                    name={
                      item.title.includes('Couch')
                        ? 'bed-outline'
                        : item.title.includes('Table')
                        ? 'restaurant-outline'
                        : 'cafe-outline'
                    }
                    size={28}
                    color="#aaa"
                  />
                </View>
              </View>
              <View style={styles.furnitureContent}>
                <Text style={styles.furnitureTitle} numberOfLines={1} ellipsizeMode="tail">
                  {item.title}
                </Text>
                <Text style={styles.furnitureOwner} numberOfLines={1} ellipsizeMode="tail">
                  Owner: {item.owner}
                </Text>
                <Text style={styles.furnitureValue}>${item.value}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['rgba(84, 109, 229, 0.12)', 'rgba(84, 109, 229, 0.05)', 'rgba(84, 109, 229, 0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={styles.headerGradient}
      />

      <StatusBar style="auto" />

      <ScrollView
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
                    outputRange: [-30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.user_metadata?.full_name || 'Roommate'}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
            <View style={styles.profileImageContainer}>
              <Text style={styles.profileInitial}>
                {(user?.user_metadata?.full_name?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.insightCards}>
          <TouchableOpacity
            style={[styles.insightCard, styles.primaryInsightCard]}
          >
            <LinearGradient
              colors={['#546DE5', '#778BEB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.insightCardGradient}
            >
              <View style={styles.insightCardContent}>
                <Ionicons name="cash-outline" size={28} color="#fff" />
                <Text style={[styles.insightCardLabel, { color: 'rgba(255,255,255,0.8)' }]}>
                  You owe
                </Text>
                <Text style={[styles.insightCardValue, { color: '#fff' }]}>$124.50</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.insightCard}>
            <View style={styles.insightCardContent}>
              <Ionicons name="arrow-down-outline" size={28} color="#20BF6B" />
              <Text style={styles.insightCardLabel}>You're owed</Text>
              <Text style={styles.insightCardValue}>$215.75</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.insightCard}>
            <View style={styles.insightCardContent}>
              <Ionicons name="calendar-outline" size={28} color="#546DE5" />
              <Text style={styles.insightCardLabel}>Rent due in</Text>
              <Text style={styles.insightCardValue}>12 days</Text>
            </View>
          </TouchableOpacity>
        </View>

        {renderExpensesSection()}
        {renderSanitizationSection()}
        {renderScheduleSection()}
        {renderFurnitureSection()}
      </ScrollView>
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
    height: height * 0.25,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 150 : 130,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  profileButton: {
    width: 44,
    height: 44,
  },
  profileImageContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#546DE5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#546DE5',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  insightCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  insightCard: {
    width: (width - 48) / 3,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryInsightCard: {
    shadowColor: '#546DE5',
    shadowOpacity: 0.25,
  },
  insightCardGradient: {
    flex: 1,
  },
  insightCardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#777',
    marginTop: 8,
    marginBottom: 4,
  },
  insightCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#546DE5',
    marginRight: 4,
  },
  expensesContainer: {
    marginBottom: 16,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  expenseIconContainer: {
    marginRight: 14,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseDetails: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  expenseSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 60,
    textAlign: 'right',
  },
  addButton: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  taskList: {
    marginBottom: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCheckboxCompleted: {
    backgroundColor: '#20BF6B',
    borderColor: '#20BF6B',
  },
  taskContent: {
    flex: 1,
    paddingRight: 12,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  taskMenuButton: {
    padding: 6,
  },
  scheduleContainer: {
    paddingRight: 10,
  },
  scheduleCard: {
    width: 160,
    height: 160,
    marginRight: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scheduleAddCard: {
    width: 160,
    height: 160,
    marginRight: 10,
    borderRadius: 16,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleAddContent: {
    alignItems: 'center',
  },
  scheduleAddIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(84, 109, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  scheduleAddText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#546DE5',
  },
  scheduleHeader: {
    padding: 12,
    alignItems: 'center',
  },
  scheduleDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleBody: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
    height: 40,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  scheduleCreator: {
    fontSize: 12,
    color: '#999',
  },
  furnitureList: {},
  furnitureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  furnitureImageContainer: {
    marginRight: 16,
  },
  furniturePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  furnitureContent: {
    flex: 1,
    paddingRight: 12,
  },
  furnitureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  furnitureOwner: {
    fontSize: 13,
    color: '#666',
    marginBottom: 1,
  },
  furnitureValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9B59B6',
  },
});

export default HomeScreen;
