import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  label?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  error?: string;
  focused?: boolean;
};

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select a date',
  label,
  onFocus,
  onBlur,
  error,
  focused = false,
}) => {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  
  // Parse the date if we have one
  const today = new Date();
  const parsedDate = value ? new Date(value) : today;
  
  // State for calendar
  const [selectedDate, setSelectedDate] = useState(parsedDate);
  const [currentMonth, setCurrentMonth] = useState(parsedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(parsedDate.getFullYear());
  
  const handleDateSelection = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    setSelectedDate(newDate);
  };
  
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };
  
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };
  
  const handleCancel = () => {
    // Reset to original date
    setSelectedDate(parsedDate);
    setCurrentMonth(parsedDate.getMonth());
    setCurrentYear(parsedDate.getFullYear());
    setShowModal(false);
    if (onBlur) onBlur();
  };
  
  const handleConfirm = () => {
    // Format date as YYYY-MM-DD
    const formattedDate = selectedDate.toISOString().split('T')[0];
    onChange(formattedDate);
    setShowModal(false);
    if (onBlur) onBlur();
  };
  
  const renderCalendarDays = () => {
    // Create array of days in month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    // Create arrays for weeks
    const calendar: (number | null)[][] = [[]];
    let week = 0;
    
    // Add empty cells for days before the 1st
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendar[0].push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      if (calendar[week].length === 7) {
        // Start a new week
        calendar.push([]);
        week++;
      }
      calendar[week].push(day);
    }
    
    // Fill in the last week with empty cells
    while (calendar[week].length < 7) {
      calendar[week].push(null);
    }
    
    // Return the calendar
    return (
      <View style={styles.calendarGrid}>
        {/* Days of the week header */}
        <View style={styles.weekdaysRow}>
          {DAYS_OF_WEEK.map((day, index) => (
            <Text key={index} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>
        
        {/* Calendar cells */}
        {calendar.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              // Check if this day is selected
              const isSelected = 
                day === selectedDate.getDate() && 
                currentMonth === selectedDate.getMonth() && 
                currentYear === selectedDate.getFullYear();
              
              // Check if this is today
              const isToday = 
                day === today.getDate() && 
                currentMonth === today.getMonth() && 
                currentYear === today.getFullYear();
              
              return (
                <TouchableOpacity
                  key={`day-${weekIndex}-${dayIndex}`}
                  style={[
                    styles.dayCell,
                    day === null ? styles.emptyCellContainer : null,
                    isToday ? styles.todayCell : null,
                    isSelected ? styles.selectedCell : null,
                  ]}
                  onPress={() => day !== null && handleDateSelection(day)}
                  disabled={day === null}
                >
                  {day !== null && (
                    <Text style={[
                      styles.dayText,
                      isToday ? styles.todayText : null,
                      isSelected ? styles.selectedDayText : null,
                    ]}>
                      {day}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };
  
  // Format date for display
  const formatDisplayDate = (date: Date): string => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };
  
  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, error && styles.errorLabel]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        style={[
          styles.inputContainer,
          focused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
        onPress={() => {
          setShowModal(true);
          if (onFocus) onFocus();
        }}
        activeOpacity={0.7}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={error ? theme.colors.error : focused ? theme.colors.primary : '#999'}
        />
        
        <Text style={[
          styles.inputText,
          !value && styles.placeholderText
        ]}>
          {value ? formatDisplayDate(parsedDate) : placeholder}
        </Text>
        
        <Ionicons
          name="chevron-down-outline"
          size={16}
          color={error ? theme.colors.error : '#999'}
        />
      </TouchableOpacity>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                {/* Header with month/year selector */}
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={handlePrevMonth}
                  >
                    <Ionicons name="chevron-back" size={24} color="#546DE5" />
                  </TouchableOpacity>
                  
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.headerMonth}>
                      {MONTH_NAMES[currentMonth]}
                    </Text>
                    <Text style={styles.headerYear}>
                      {currentYear}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={handleNextMonth}
                  >
                    <Ionicons name="chevron-forward" size={24} color="#546DE5" />
                  </TouchableOpacity>
                </View>
                
                {/* Calendar */}
                {renderCalendarDays()}
                
                {/* Action buttons */}
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancel}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleConfirm}
                  >
                    <LinearGradient
                      colors={['#3a7bd5', '#546DE5', '#778BEB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.actionButtonGradient}
                    >
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  errorLabel: {
    color: '#EB4D4B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eeeeee',
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    padding: 0,
    paddingHorizontal: 18,
    height: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: '#546DE5',
    backgroundColor: '#fff',
    shadowColor: '#546DE5',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  inputContainerError: {
    borderColor: '#EB4D4B',
  },
  inputText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '400',
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  errorText: {
    color: '#EB4D4B',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerMonth: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerYear: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  calendarGrid: {
    marginBottom: 20,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  emptyCellContainer: {
    // Style for empty cells
  },
  todayCell: {
    backgroundColor: '#F0F4FF',
  },
  selectedCell: {
    backgroundColor: '#546DE5',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  todayText: {
    fontWeight: '700',
    color: '#546DE5',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: '700',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 100,
  },
  cancelButton: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DatePicker;
