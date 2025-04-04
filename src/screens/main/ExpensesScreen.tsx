import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { logDebug } from '../../utils/DebugHelper';
import { useNavigation } from '@react-navigation/native';
import HomeIsland, { IslandMode } from '../../components/HomeIsland';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Temporary mock data until we connect to API
const MOCK_EXPENSES = [
  { 
    id: '1', 
    title: 'Internet Bill', 
    amount: 89.99, 
    date: '2023-11-10', 
    paidBy: 'Alex', 
    category: 'Utilities',
    split: [
      { name: 'You', amount: 29.99, paid: true },
      { name: 'Alex', amount: 30.00, paid: true },
      { name: 'Jordan', amount: 30.00, paid: false },
    ],
    icon: 'wifi'
  },
  { 
    id: '2', 
    title: 'Grocery Shopping', 
    amount: 124.56, 
    date: '2023-11-12', 
    paidBy: 'You', 
    category: 'Groceries',
    split: [
      { name: 'You', amount: 41.52, paid: true },
      { name: 'Alex', amount: 41.52, paid: false },
      { name: 'Jordan', amount: 41.52, paid: true },
    ],
    icon: 'cart'
  },
  { 
    id: '3', 
    title: 'Electricity Bill', 
    amount: 75.25, 
    date: '2023-11-05', 
    paidBy: 'Jordan', 
    category: 'Utilities',
    split: [
      { name: 'You', amount: 25.08, paid: true },
      { name: 'Alex', amount: 25.08, paid: true },
      { name: 'Jordan', amount: 25.09, paid: true },
    ],
    icon: 'flash'
  },
  { 
    id: '4', 
    title: 'Movie Night', 
    amount: 42.50, 
    date: '2023-11-14', 
    paidBy: 'Jordan', 
    category: 'Entertainment',
    split: [
      { name: 'You', amount: 14.17, paid: false },
      { name: 'Alex', amount: 14.17, paid: false },
      { name: 'Jordan', amount: 14.16, paid: true },
    ],
    icon: 'film'
  },
  { 
    id: '5', 
    title: 'Water Bill', 
    amount: 45.00, 
    date: '2023-11-08', 
    paidBy: 'Alex', 
    category: 'Utilities',
    split: [
      { name: 'You', amount: 15.00, paid: true },
      { name: 'Alex', amount: 15.00, paid: true },
      { name: 'Jordan', amount: 15.00, paid: false },
    ],
    icon: 'water'
  },
];

// Mock spending distribution for charts
const SPENDING_DISTRIBUTION = [
  { category: 'Utilities', percentage: 45, color: '#5D78FF' },
  { category: 'Groceries', percentage: 23, color: '#FF9855' },
  { category: 'Entertainment', percentage: 12, color: '#9F71ED' },
  { category: 'Rent', percentage: 10, color: '#EB5982' }, 
  { category: 'Other', percentage: 10, color: '#26C6DA' }
];

const ExpensesScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigation = useNavigation();

  // State variables
  const [islandMode, setIslandMode] = useState<IslandMode>('expenses');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expenses, setExpenses] = useState(MOCK_EXPENSES);
  const [summaryView, setSummaryView] = useState<'owed' | 'distribution'>('owed');
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerAnimation = useRef(new Animated.Value(0)).current;
  const chartAnimation = useRef(new Animated.Value(0)).current;
  const listAnimation = useRef(new Animated.Value(0)).current;

  // Animate on mount
  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(chartAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(listAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    showNotification('Updated', 'Your expenses have been refreshed', 'success');
    setRefreshing(false);
  };

  const handleIslandAction = () => {
    showNotification('New Expense', 'Creating a new expense...', 'info');
    // Navigate to create expense screen
  };

  const toggleExpenseDetails = (id: string) => {
    setExpandedExpense(expandedExpense === id ? null : id);
  };

  // Calculate total amounts
  const totalOwed = expenses.reduce((sum, expense) => {
    const yourSplit = expense.split.find(s => s.name === 'You');
    if (yourSplit && !yourSplit.paid && expense.paidBy !== 'You') {
      return sum + yourSplit.amount;
    }
    return sum;
  }, 0);

  const totalOwedToYou = expenses.reduce((sum, expense) => {
    if (expense.paidBy === 'You') {
      const unpaidAmount = expense.split
        .filter(s => s.name !== 'You' && !s.paid)
        .reduce((total, split) => total + split.amount, 0);
      return sum + unpaidAmount;
    }
    return sum;
  }, 0);

  // Filter expenses
  const getFilteredExpenses = () => {
    if (activeFilter === 'all') return expenses;
    if (activeFilter === 'you_paid') return expenses.filter(e => e.paidBy === 'You');
    if (activeFilter === 'you_owe') {
      return expenses.filter(e => {
        const yourSplit = e.split.find(s => s.name === 'You');
        return yourSplit && !yourSplit.paid && e.paidBy !== 'You';
      });
    }
    if (activeFilter === 'owed_to_you') {
      return expenses.filter(e => {
        if (e.paidBy !== 'You') return false;
        return e.split.some(s => s.name !== 'You' && !s.paid);
      });
    }
    return expenses;
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const match = SPENDING_DISTRIBUTION.find(item => item.category === category);
    return match ? match.color : '#26C6DA';
  };
  
  // Render category icon with background
  const renderCategoryIcon = (icon: string, category: string) => {
    const bgColor = `${getCategoryColor(category)}20`;
    const iconColor = getCategoryColor(category);
    
    return (
      <View style={[styles.categoryIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={`${icon}-outline`} size={18} color={iconColor} />
      </View>
    );
  };

  // Render individual expense card
  const renderExpenseItem = ({ item }: { item: typeof MOCK_EXPENSES[0] }) => {
    const isExpanded = expandedExpense === item.id;
    const yourSplit = item.split.find(s => s.name === 'You');
    
    return (
      <Animated.View 
        style={[
          styles.expenseCard,
          { backgroundColor: theme.colors.card }
        ]}
      >
        <TouchableOpacity 
          style={styles.expenseHeader}
          onPress={() => toggleExpenseDetails(item.id)}
          activeOpacity={0.7}
        >
          {renderCategoryIcon(item.icon, item.category)}
          
          <View style={styles.expenseInfo}>
            <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
              {item.title}
            </Text>
            <Text style={styles.expenseDate}>
              {new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })} • Paid by {item.paidBy}
            </Text>
          </View>
          
          <View style={styles.expenseAmountContainer}>
            <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
              ${item.amount.toFixed(2)}
            </Text>
            
            {/* If you owe money on this expense, show amount */}
            {yourSplit && !yourSplit.paid && item.paidBy !== 'You' && (
              <Text style={styles.youOweText}>
                You owe ${yourSplit.amount.toFixed(2)}
              </Text>
            )}
            
            {/* If others owe you money on this expense, show indicator */}
            {item.paidBy === 'You' && item.split.some(s => s.name !== 'You' && !s.paid) && (
              <Text style={styles.owedToYouText}>
                Owed to you
              </Text>
            )}
          </View>
          
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={isDarkMode ? '#999' : '#777'}
            style={styles.expandIcon}
          />
        </TouchableOpacity>
        
        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.expenseDetails}>
            <View style={styles.splitHeader}>
              <Text style={[styles.splitHeaderText, { color: theme.colors.text }]}>
                Split Details
              </Text>
            </View>
            
            {item.split.map((split, index) => (
              <View key={index} style={styles.splitItem}>
                <Text style={[styles.splitName, { color: theme.colors.text }]}>
                  {split.name}
                </Text>
                <Text style={styles.splitAmount}>
                  ${split.amount.toFixed(2)}
                </Text>
                {split.paid ? (
                  <View style={styles.paidBadge}>
                    <Text style={styles.paidText}>Paid</Text>
                  </View>
                ) : (
                  <View style={styles.unpaidBadge}>
                    <Text style={styles.unpaidText}>Unpaid</Text>
                  </View>
                )}
              </View>
            ))}
            
            <View style={styles.expenseActions}>
              {item.paidBy === 'You' ? (
                <TouchableOpacity style={styles.reminderButton}>
                  <Ionicons name="notifications-outline" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Send Reminder</Text>
                </TouchableOpacity>
              ) : yourSplit && !yourSplit.paid ? (
                <TouchableOpacity style={styles.payButton}>
                  <Ionicons name="wallet-outline" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Pay Now</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.detailsButton}>
                  <Ionicons name="document-text-outline" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>View Receipt</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  // Render distribution chart using SVG
  const renderDistributionChart = () => {
    const totalPercent = SPENDING_DISTRIBUTION.reduce((sum, item) => sum + item.percentage, 0);
    let currentAngle = 0;

    return (
      <View style={styles.chartContainer}>
        <Svg height="160" width="160" viewBox="0 0 100 100">
          {SPENDING_DISTRIBUTION.map((item, index) => {
            // Calculate the slice
            const angle = (item.percentage / totalPercent) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;
            const endAngle = currentAngle;
            
            // Convert to radians
            const startRad = (startAngle - 90) * Math.PI / 180;
            const endRad = (endAngle - 90) * Math.PI / 180;
            
            // Calculate points
            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);
            
            // Path for the slice
            const largeArcFlag = angle > 180 ? 1 : 0;
            const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
            
            return (
              <Circle 
                key={index}
                cx="50"
                cy="50"
                r="40" 
                strokeWidth={(40 * item.percentage / totalPercent)}
                stroke={item.color}
                strokeDasharray={(Math.PI * 80 * item.percentage / totalPercent) + " " + (Math.PI * 80)}
                strokeDashoffset={-(Math.PI * 80 * startAngle / 360)}
                fill="none"
              />
            );
          })}
          {/* Center circle for donut effect */}
          <Circle cx="50" cy="50" r="30" fill={theme.colors.card} />
        </Svg>
        
        {/* Legend for chart */}
        <View style={styles.chartLegend}>
          {SPENDING_DISTRIBUTION.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View 
                style={[
                  styles.legendColor, 
                  { backgroundColor: item.color }
                ]} 
              />
              <Text style={[styles.legendText, { color: theme.colors.text }]}>
                {item.category} ({item.percentage}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Gradient background for header */}
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
      
      {/* HomeIsland component */}
      <View style={styles.islandContainer}>
        <HomeIsland
          mode={islandMode}
          onModeChange={setIslandMode}
          onActionPress={handleIslandAction}
          navigation={navigation}
          contextMode="home"
          data={{
            expenses: MOCK_EXPENSES,
            tasks: [],
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
        {/* Animated Header */}
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
            <Text style={styles.headerTitle}>Expenses</Text>
            <Text style={styles.headerSubtitle}>
              Track shared expenses and manage what you owe
            </Text>
          </View>
        </Animated.View>
        
        {/* Financial Summary Cards */}
        <Animated.View
          style={[
            styles.summaryContainer,
            {
              opacity: chartAnimation,
              transform: [
                {
                  translateY: chartAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Toggle button between views */}
          <View style={styles.summaryToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                summaryView === 'owed' && styles.toggleButtonActive,
                { borderColor: isDarkMode ? '#333' : '#eee' }
              ]}
              onPress={() => setSummaryView('owed')}
            >
              <Text 
                style={[
                  styles.toggleButtonText,
                  summaryView === 'owed' && styles.toggleButtonTextActive,
                  { color: summaryView === 'owed' ? theme.colors.primary : isDarkMode ? '#999' : '#666' }
                ]}
              >
                Balance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                summaryView === 'distribution' && styles.toggleButtonActive,
                { borderColor: isDarkMode ? '#333' : '#eee' }
              ]}
              onPress={() => setSummaryView('distribution')}
            >
              <Text 
                style={[
                  styles.toggleButtonText,
                  summaryView === 'distribution' && styles.toggleButtonTextActive,
                  { color: summaryView === 'distribution' ? theme.colors.primary : isDarkMode ? '#999' : '#666' }
                ]}
              >
                Distribution
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content based on selected view */}
          {summaryView === 'owed' ? (
            <View style={styles.balanceCards}>
              <View style={[styles.balanceCard, { backgroundColor: theme.colors.card }]}>
                <Text style={styles.balanceLabel}>You Owe</Text>
                <Text style={[styles.balanceAmount, styles.youOweAmount]}>
                  ${totalOwed.toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.balanceCard, { backgroundColor: theme.colors.card }]}>
                <Text style={styles.balanceLabel}>Owed to You</Text>
                <Text style={[styles.balanceAmount, styles.owedToYouAmount]}>
                  ${totalOwedToYou.toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.balanceCard, { backgroundColor: theme.colors.card }]}>
                <Text style={styles.balanceLabel}>Net Balance</Text>
                <Text 
                  style={[
                    styles.balanceAmount, 
                    totalOwedToYou - totalOwed > 0 ? styles.positiveBalance : styles.negativeBalance
                  ]}
                >
                  ${(totalOwedToYou - totalOwed).toFixed(2)}
                </Text>
              </View>
            </View>
          ) : (
            // Spending distribution chart
            <View style={[styles.distributionCard, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.distributionTitle, { color: theme.colors.text }]}>
                Spending Distribution
              </Text>
              {renderDistributionChart()}
            </View>
          )}
        </Animated.View>
        
        {/* Expense Filter Tabs */}
        <Animated.View
          style={[
            styles.filterContainer,
            {
              opacity: listAnimation,
              transform: [
                {
                  translateY: listAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'you_paid', label: 'You Paid' },
              { id: 'you_owe', label: 'You Owe' },
              { id: 'owed_to_you', label: 'Owed to You' },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterButton,
                  activeFilter === filter.id && styles.activeFilterButton,
                  { 
                    backgroundColor: activeFilter === filter.id 
                      ? theme.colors.primary 
                      : isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' 
                  }
                ]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <Text 
                  style={[
                    styles.filterText,
                    { 
                      color: activeFilter === filter.id 
                        ? '#fff' 
                        : isDarkMode ? '#ccc' : '#666' 
                    }
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
        
        {/* Expense List */}
        <Animated.View
          style={[
            styles.expenseListContainer,
            {
              opacity: listAnimation,
              transform: [
                {
                  translateY: listAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: isDarkMode ? '#999' : '#666' }]}>
            {getFilteredExpenses().length} Expenses
          </Text>
          
          {getFilteredExpenses().length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.card }]}>
              <Ionicons 
                name="document-text-outline" 
                size={44} 
                color={isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'} 
              />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No expenses found
              </Text>
              <Text style={styles.emptyStateSubText}>
                Try changing the filter or add a new expense
              </Text>
            </View>
          ) : (
            getFilteredExpenses().map((item) => (
              <View key={item.id} style={{ marginBottom: 12 }}>
                {renderExpenseItem({ item })}
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>
      
      {/* Floating Add Button */}
      <TouchableOpacity 
        style={[styles.floatingButton, { backgroundColor: theme.colors.primary }]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#546DE5', '#778BEB']}
          style={styles.gradientButton}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
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
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryToggle: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(84, 109, 229, 0.1)',
  },
  toggleButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  toggleButtonTextActive: {
    fontWeight: '700',
  },
  balanceCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceCard: {
    width: '31%',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  youOweAmount: {
    color: '#EB4D4B',
  },
  owedToYouAmount: {
    color: '#20BF6B',
  },
  positiveBalance: {
    color: '#20BF6B',
  },
  negativeBalance: {
    color: '#EB4D4B',
  },
  distributionCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  distributionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterScrollContent: {
    paddingRight: 20,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeFilterButton: {
    backgroundColor: '#546DE5',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  expenseListContainer: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  expenseCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  expenseDate: {
    fontSize: 12,
    color: '#888',
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  youOweText: {
    fontSize: 11,
    color: '#EB4D4B',
    fontWeight: '500',
  },
  owedToYouText: {
    fontSize: 11,
    color: '#20BF6B',
    fontWeight: '500',
  },
  expandIcon: {
    marginLeft: 4,
  },
  expenseDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: 12,
  },
  splitHeader: {
    marginBottom: 12,
  },
  splitHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  splitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  splitName: {
    flex: 1,
    fontSize: 14,
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 12,
    color: '#666',
  },
  paidBadge: {
    backgroundColor: 'rgba(32, 191, 107, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  paidText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#20BF6B',
  },
  unpaidBadge: {
    backgroundColor: 'rgba(235, 77, 75, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  unpaidText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#EB4D4B',
  },
  expenseActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#546DE5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20BF6B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#546DE5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  floatingButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#546DE5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ExpensesScreen;
