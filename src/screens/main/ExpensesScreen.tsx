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
  Modal,
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

// Mock expense groups
const MOCK_EXPENSE_GROUPS = [
  { 
    id: '1', 
    name: 'Apartment', 
    members: ['You', 'Alex', 'Jordan'], 
    icon: 'home',
    color: '#546DE5'
  },
  { 
    id: '2', 
    name: 'Road Trip', 
    members: ['You', 'Alex', 'Sarah', 'Mike'], 
    icon: 'car',
    color: '#20BF6B'
  },
  { 
    id: '3', 
    name: 'Groceries', 
    members: ['You', 'Alex'], 
    icon: 'cart',
    color: '#FF9855'
  }
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
  const [splitType, setSplitType] = useState<'individual' | 'group'>('individual');
  const [expenseGroups, setExpenseGroups] = useState(MOCK_EXPENSE_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);

  // Add new state for expense creation modal
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [newExpense, setNewExpense] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Utilities',
    paidBy: 'You',
    splitMethod: 'equal'
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['You', 'Alex', 'Jordan']);
  
  // Available categories with icons and colors
  const expenseCategories = [
    { id: 'Utilities', name: 'Utilities', icon: 'flash', color: '#5D78FF' },
    { id: 'Groceries', name: 'Groceries', icon: 'cart', color: '#FF9855' },
    { id: 'Rent', name: 'Rent', icon: 'home', color: '#EB5982' },
    { id: 'Entertainment', name: 'Entertainment', icon: 'film', color: '#9F71ED' },
    { id: 'Other', name: 'Other', icon: 'ellipsis-horizontal', color: '#26C6DA' }
  ];

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

  // Enhanced handleIslandAction to show expense creation modal
  const handleIslandAction = () => {
    if (islandMode === 'expenses') {
      setShowExpenseModal(true);
    } else {
      // Show a notification for other island modes
      showNotification(islandMode.charAt(0).toUpperCase() + islandMode.slice(1), 
        `${islandMode} action coming soon!`, 'info');
    }
  };

  const toggleExpenseDetails = (id: string) => {
    setExpandedExpense(expandedExpense === id ? null : id);
  };

  const toggleSplitType = () => {
    setSplitType(prev => prev === 'individual' ? 'group' : 'individual');
    setActiveFilter('all');
    setSelectedGroup(null);
  };

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(selectedGroup === groupId ? null : groupId);
  };

  const handleCreateGroup = (name: string, members: string[], icon: string, color: string) => {
    const newGroup = {
      id: `group_${Date.now()}`,
      name,
      members,
      icon,
      color
    };
    
    setExpenseGroups(prev => [...prev, newGroup]);
    setShowGroupModal(false);
    showNotification('Success', `Created new group: ${name}`, 'success');
  };

  const getGroupFilteredExpenses = () => {
    if (!selectedGroup) return expenses;
    
    const group = expenseGroups.find(g => g.id === selectedGroup);
    if (!group) return expenses;
    
    return expenses.filter(expense => {
      const splitMembers = expense.split.map(s => s.name);
      return splitMembers.every(member => 
        member === 'You' || group.members.includes(member)
      );
    });
  };

  const getFilteredExpenses = () => {
    let filteredExpenses = splitType === 'group' 
      ? getGroupFilteredExpenses()
      : expenses;
      
    if (activeFilter === 'all') return filteredExpenses;
    if (activeFilter === 'you_paid') return filteredExpenses.filter(e => e.paidBy === 'You');
    if (activeFilter === 'you_owe') {
      return filteredExpenses.filter(e => {
        const yourSplit = e.split.find(s => s.name === 'You');
        return yourSplit && !yourSplit.paid && e.paidBy !== 'You';
      });
    }
    if (activeFilter === 'owed_to_you') {
      return filteredExpenses.filter(e => {
        if (e.paidBy !== 'You') return false;
        return e.split.some(s => s.name !== 'You' && !s.paid);
      });
    }
    return filteredExpenses;
  };

  const renderExpenseGroupCards = () => {
    return (
      <View style={styles.groupCardsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.groupCardsScroll}
        >
          {expenseGroups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupCard,
                selectedGroup === group.id && styles.groupCardSelected,
                { borderColor: group.color }
              ]}
              onPress={() => handleGroupSelect(group.id)}
            >
              <View 
                style={[
                  styles.groupIconContainer, 
                  { backgroundColor: `${group.color}20` }
                ]}
              >
                <Ionicons name={`${group.icon}-outline`} size={24} color={group.color} />
              </View>
              
              <Text style={[styles.groupName, { color: theme.colors.text }]}>
                {group.name}
              </Text>
              
              <Text style={styles.groupMembers}>
                {group.members.length} members
              </Text>
              
              {selectedGroup === group.id && (
                <View style={[styles.groupSelectedIndicator, { backgroundColor: group.color }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.addGroupCard}
            onPress={() => setShowGroupModal(true)}
          >
            <View style={styles.addGroupIconContainer}>
              <Ionicons name="add" size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.addGroupText}>Create Group</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const renderCreateGroupModal = () => {
    const [groupName, setGroupName] = useState('');
    const [groupIcon, setGroupIcon] = useState('people');
    const [groupColor, setGroupColor] = useState('#546DE5');
    
    const iconOptions = ['people', 'home', 'car', 'cart', 'restaurant', 'beer'];
    const colorOptions = ['#546DE5', '#20BF6B', '#FF9855', '#EB5982', '#9F71ED', '#26C6DA'];
    
    return (
      <Modal
        visible={showGroupModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Create Expense Group
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowGroupModal(false)}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.groupInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
              placeholder="Group Name"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={groupName}
              onChangeText={setGroupName}
            />
            
            <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>
              Choose Icon
            </Text>
            
            <View style={styles.iconOptionsContainer}>
              {iconOptions.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    groupIcon === icon && { backgroundColor: `${groupColor}20` }
                  ]}
                  onPress={() => setGroupIcon(icon)}
                >
                  <Ionicons name={`${icon}-outline`} size={24} color={groupIcon === icon ? groupColor : isDarkMode ? '#999' : '#666'} />
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>
              Choose Color
            </Text>
            
            <View style={styles.colorOptionsContainer}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    groupColor === color && styles.colorOptionSelected
                  ]}
                  onPress={() => setGroupColor(color)}
                />
              ))}
            </View>
            
            <TouchableOpacity
              style={[
                styles.createGroupButton,
                { backgroundColor: groupColor },
                !groupName.trim() && styles.createGroupButtonDisabled
              ]}
              disabled={!groupName.trim()}
              onPress={() => handleCreateGroup(groupName, ['You', 'Alex', 'Jordan'], groupIcon, groupColor)}
            >
              <Text style={styles.createGroupButtonText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Method to handle expense creation
  const handleAddExpense = () => {
    if (!newExpense.title || !newExpense.amount) {
      showNotification('Error', 'Please fill in all required fields', 'error');
      return;
    }
    
    const amount = parseFloat(newExpense.amount);
    if (isNaN(amount) || amount <= 0) {
      showNotification('Error', 'Please enter a valid amount', 'error');
      return;
    }
    
    // Calculate splits based on selected method and members
    const splitAmount = amount / selectedMembers.length;
    const splits = selectedMembers.map(member => ({
      name: member,
      amount: parseFloat(splitAmount.toFixed(2)),
      paid: member === newExpense.paidBy
    }));
    
    // Create new expense object
    const expense = {
      id: `expense_${Date.now()}`,
      title: newExpense.title,
      amount,
      date: newExpense.date,
      paidBy: newExpense.paidBy,
      category: newExpense.category,
      split: splits,
      icon: expenseCategories.find(c => c.id === newExpense.category)?.icon || 'cash'
    };
    
    // Add to expenses list
    setExpenses(prev => [expense, ...prev]);
    
    // Reset form and close modal
    setNewExpense({
      title: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      category: 'Utilities',
      paidBy: 'You',
      splitMethod: 'equal'
    });
    setShowExpenseModal(false);
    
    showNotification('Success', 'New expense added successfully', 'success');
  };

  // Render expense creation modal
  const renderExpenseModal = () => {
    return (
      <Modal
        visible={showExpenseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExpenseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.expenseModalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Add New Expense
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowExpenseModal(false)}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.expenseForm}>
              {/* Title Input */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Expense Title *
              </Text>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                value={newExpense.title}
                onChangeText={(text) => setNewExpense(prev => ({ ...prev, title: text }))}
                placeholder="e.g. Internet Bill"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
              />

              {/* Amount Input */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Amount *
              </Text>
              <View style={styles.amountInputContainer}>
                <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>$</Text>
                <TextInput
                  style={[styles.amountInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                  value={newExpense.amount}
                  onChangeText={(text) => setNewExpense(prev => ({ ...prev, amount: text }))}
                  placeholder="0.00"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Date Input */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Date
              </Text>
              <TextInput
                style={[styles.textInput, { color: theme.colors.text, borderColor: isDarkMode ? '#333' : '#eee' }]}
                value={newExpense.date}
                onChangeText={(text) => setNewExpense(prev => ({ ...prev, date: text }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
              />

              {/* Category Selection */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Category
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryContainer}
              >
                {expenseCategories.map(category => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      newExpense.category === category.id && styles.categoryButtonSelected,
                      { borderColor: category.color }
                    ]}
                    onPress={() => setNewExpense(prev => ({ ...prev, category: category.id }))}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                      <Ionicons name={`${category.icon}-outline`} size={16} color={category.color} />
                    </View>
                    <Text 
                      style={[
                        styles.categoryName, 
                        { color: newExpense.category === category.id ? category.color : isDarkMode ? '#999' : '#666' }
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Paid By Selector */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Paid By
              </Text>
              <View style={styles.paidByContainer}>
                {['You', 'Alex', 'Jordan'].map(person => (
                  <TouchableOpacity
                    key={person}
                    style={[
                      styles.paidByButton,
                      newExpense.paidBy === person && styles.paidByButtonSelected
                    ]}
                    onPress={() => setNewExpense(prev => ({ ...prev, paidBy: person }))}
                  >
                    <Text 
                      style={[
                        styles.paidByButtonText,
                        { color: newExpense.paidBy === person ? '#fff' : isDarkMode ? '#999' : '#666' }
                      ]}
                    >
                      {person}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Split With Selector */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Split With
              </Text>
              <View style={styles.splitWithContainer}>
                {['You', 'Alex', 'Jordan'].map(person => (
                  <TouchableOpacity
                    key={person}
                    style={[
                      styles.splitWithButton,
                      selectedMembers.includes(person) && styles.splitWithButtonSelected
                    ]}
                    onPress={() => {
                      // Cannot deselect the person who paid
                      if (person === newExpense.paidBy) return;
                      
                      // Toggle selection
                      setSelectedMembers(prev => 
                        prev.includes(person) 
                          ? prev.filter(p => p !== person) 
                          : [...prev, person]
                      );
                    }}
                    disabled={person === newExpense.paidBy}
                  >
                    <Text 
                      style={[
                        styles.splitWithButtonText,
                        { color: selectedMembers.includes(person) ? '#fff' : isDarkMode ? '#999' : '#666' }
                      ]}
                    >
                      {person}
                    </Text>
                    {selectedMembers.includes(person) && (
                      <Ionicons name="checkmark" size={14} color="#fff" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowExpenseModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddExpense}
              >
                <Text style={styles.addButtonText}>Add Expense</Text>
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
        
        <Animated.View
          style={[
            styles.splitTypeContainer,
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
          <TouchableOpacity
            style={[
              styles.splitTypeButton,
              splitType === 'individual' && styles.splitTypeActive,
              { borderColor: isDarkMode ? '#333' : '#e0e0e0' }
            ]}
            onPress={() => setSplitType('individual')}
          >
            <Ionicons 
              name="person-outline" 
              size={18} 
              color={splitType === 'individual' ? theme.colors.primary : isDarkMode ? '#999' : '#666'} 
            />
            <Text 
              style={[
                styles.splitTypeText, 
                { color: splitType === 'individual' ? theme.colors.primary : isDarkMode ? '#999' : '#666' }
              ]}
            >
              Individual Splits
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.splitTypeButton,
              splitType === 'group' && styles.splitTypeActive,
              { borderColor: isDarkMode ? '#333' : '#e0e0e0' }
            ]}
            onPress={() => setSplitType('group')}
          >
            <Ionicons 
              name="people-outline" 
              size={18} 
              color={splitType === 'group' ? theme.colors.primary : isDarkMode ? '#999' : '#666'} 
            />
            <Text 
              style={[
                styles.splitTypeText, 
                { color: splitType === 'group' ? theme.colors.primary : isDarkMode ? '#999' : '#666' }
              ]}
            >
              Group Splits
            </Text>
          </TouchableOpacity>
        </Animated.View>
        
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

          {summaryView === 'owed' ? (
            <View style={styles.balanceCards}>
              <View style={[styles.balanceCard, { backgroundColor: theme.colors.card }]}>
                <Text style={styles.balanceLabel}>You Owe</Text>
                <Text style={[styles.balanceAmount, styles.youOweAmount]}>
                  ${expenses.reduce((sum, expense) => {
                    const yourSplit = expense.split.find(s => s.name === 'You');
                    if (yourSplit && !yourSplit.paid && expense.paidBy !== 'You') {
                      return sum + yourSplit.amount;
                    }
                    return sum;
                  }, 0).toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.balanceCard, { backgroundColor: theme.colors.card }]}>
                <Text style={styles.balanceLabel}>Owed to You</Text>
                <Text style={[styles.balanceAmount, styles.owedToYouAmount]}>
                  ${expenses.reduce((sum, expense) => {
                    if (expense.paidBy === 'You') {
                      const unpaidAmount = expense.split
                        .filter(s => s.name !== 'You' && !s.paid)
                        .reduce((total, split) => total + split.amount, 0);
                      return sum + unpaidAmount;
                    }
                    return sum;
                  }, 0).toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.balanceCard, { backgroundColor: theme.colors.card }]}>
                <Text style={styles.balanceLabel}>Net Balance</Text>
                <Text 
                  style={[
                    styles.balanceAmount, 
                    expenses.reduce((sum, expense) => {
                      if (expense.paidBy === 'You') {
                        const unpaidAmount = expense.split
                          .filter(s => s.name !== 'You' && !s.paid)
                          .reduce((total, split) => total + split.amount, 0);
                        return sum + unpaidAmount;
                      }
                      return sum;
                    }, 0) - expenses.reduce((sum, expense) => {
                      const yourSplit = expense.split.find(s => s.name === 'You');
                      if (yourSplit && !yourSplit.paid && expense.paidBy !== 'You') {
                        return sum + yourSplit.amount;
                      }
                      return sum;
                    }, 0) > 0 ? styles.positiveBalance : styles.negativeBalance
                  ]}
                >
                  ${(expenses.reduce((sum, expense) => {
                    if (expense.paidBy === 'You') {
                      const unpaidAmount = expense.split
                        .filter(s => s.name !== 'You' && !s.paid)
                        .reduce((total, split) => total + split.amount, 0);
                      return sum + unpaidAmount;
                    }
                    return sum;
                  }, 0) - expenses.reduce((sum, expense) => {
                    const yourSplit = expense.split.find(s => s.name === 'You');
                    if (yourSplit && !yourSplit.paid && expense.paidBy !== 'You') {
                      return sum + yourSplit.amount;
                    }
                    return sum;
                  }, 0)).toFixed(2)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.distributionCard, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.distributionTitle, { color: theme.colors.text }]}>
                Spending Distribution
              </Text>
              {/* Render distribution chart */}
            </View>
          )}
        </Animated.View>
        
        {splitType === 'group' && renderExpenseGroupCards()}
        
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
                {/* Render expense item */}
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>
      
      {renderCreateGroupModal()}
      {renderExpenseModal()}
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
  splitTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  splitTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    marginHorizontal: 6,
    borderRadius: 20,
  },
  splitTypeActive: {
    backgroundColor: 'rgba(84, 109, 229, 0.1)',
    borderColor: 'rgba(84, 109, 229, 0.3)',
  },
  splitTypeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  groupCardsContainer: {
    marginBottom: 16,
  },
  groupCardsScroll: {
    paddingLeft: 6,
    paddingRight: 20,
    paddingVertical: 8,
  },
  groupCard: {
    width: 120,
    height: 140,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
    borderRadius: 16,
    marginLeft: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  groupCardSelected: {
    borderWidth: 2,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
  },
  groupIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 12,
    color: '#999',
  },
  groupSelectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#546DE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addGroupCard: {
    width: 120,
    height: 140,
    backgroundColor: 'rgba(84, 109, 229, 0.08)',
    borderRadius: 16,
    marginLeft: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(84, 109, 229, 0.3)',
  },
  addGroupIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(84, 109, 229, 0.1)',
  },
  addGroupText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#546DE5',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '90%',
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  groupInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  iconOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  colorOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
    marginBottom: 12,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: 'white',
  },
  createGroupButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createGroupButtonDisabled: {
    opacity: 0.5,
  },
  createGroupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  expenseModalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  expenseForm: {
    marginVertical: 10,
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '500',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  categoryButton: {
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryButtonSelected: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
  },
  paidByContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  paidByButton: {
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  paidByButtonSelected: {
    backgroundColor: '#546DE5',
    borderColor: '#546DE5',
  },
  paidByButtonText: {
    fontWeight: '500',
    fontSize: 14,
  },
  splitWithContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  splitWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  splitWithButtonSelected: {
    backgroundColor: '#20BF6B',
    borderColor: '#20BF6B',
  },
  splitWithButtonText: {
    fontWeight: '500',
    fontSize: 14,
  },
  checkIcon: {
    marginLeft: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  addButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#546DE5',
    marginLeft: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExpensesScreen;
