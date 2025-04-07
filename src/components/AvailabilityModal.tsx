import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { saveUserAvailability, getUserAvailability } from '../services/api/availabilityService';

// Get screen dimensions for better sizing
const { width, height } = Dimensions.get('window');

interface AvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
}

// Days of week
const DAYS = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
];

// Time slots
const TIME_SLOTS = [
  { id: 'morning', label: 'Morning (6AM-12PM)', icon: 'sunny-outline' },
  { id: 'afternoon', label: 'Afternoon (12PM-5PM)', icon: 'partly-sunny-outline' },
  { id: 'evening', label: 'Evening (5PM-10PM)', icon: 'moon-outline' },
  { id: 'night', label: 'Night (10PM-6AM)', icon: 'star-outline' },
];

interface Availability {
  [day: string]: {
    [timeSlot: string]: boolean;
  };
}

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ visible, onClose }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [availability, setAvailability] = useState<Availability>({});
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initialize availability state with empty values
  useEffect(() => {
    if (visible) {
      initializeAvailability();
    }
  }, [visible]);

  const initializeAvailability = async () => {
    setLoading(true);
    setIsInitialized(false);
    
    try {
      // Initialize with empty structure
      const initialAvailability: Availability = {};
      
      DAYS.forEach(day => {
        initialAvailability[day.id] = {};
        TIME_SLOTS.forEach(slot => {
          initialAvailability[day.id][slot.id] = false;
        });
      });
      
      if (user?.id) {
        // Try to fetch existing availability data
        const existingData = await getUserAvailability(user.id);
        if (existingData) {
          console.log('Loading existing availability data:', existingData);
          setAvailability(existingData);
        } else {
          console.log('No existing availability data, using initial empty state');
          setAvailability(initialAvailability);
        }
      } else {
        setAvailability(initialAvailability);
      }

      // Mark as initialized to ensure rendering
      setIsInitialized(true);
    } catch (error) {
      console.error('Error loading availability:', error);
      showNotification('Error', 'Failed to load your availability settings', 'error');
      
      // Even on error, we should mark as initialized with empty data
      setIsInitialized(true);
      setAvailability({});
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTimeSlot = (day: string, timeSlot: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [timeSlot]: !prev[day]?.[timeSlot]
      }
    }));
  };

  const handleToggleAllForDay = (day: string) => {
    // Check if all slots for this day are already selected
    const daySlots = availability[day] || {};
    const allSelected = TIME_SLOTS.every(slot => daySlots[slot.id]);
    
    // Toggle all slots for this day based on current state
    setAvailability(prev => {
      const updatedDay = {};
      TIME_SLOTS.forEach(slot => {
        updatedDay[slot.id] = !allSelected;
      });
      
      return {
        ...prev,
        [day]: updatedDay
      };
    });
  };

  const handleToggleAllForTimeSlot = (timeSlot: string) => {
    // Check if this time slot is selected for all days
    const allSelected = DAYS.every(day => availability[day.id]?.[timeSlot]);
    
    // Toggle this time slot for all days based on current state
    setAvailability(prev => {
      const updated = { ...prev };
      DAYS.forEach(day => {
        if (!updated[day.id]) updated[day.id] = {};
        updated[day.id][timeSlot] = !allSelected;
      });
      return updated;
    });
  };

  const saveAvailability = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      await saveUserAvailability(user.id, availability);
      showNotification('Success', 'Your availability has been saved', 'success');
      onClose();
    } catch (error) {
      console.error('Error saving availability:', error);
      showNotification('Error', 'Failed to save your availability', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContainer, 
          { backgroundColor: theme.colors.card }
        ]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Set Your Availability
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#999' : '#666'} />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                Loading your availability settings...
              </Text>
            </View>
          ) : (
            <>
              <ScrollView 
                style={styles.scrollContent}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={true}
              >
                <Text style={[styles.subtitle, { color: theme.colors.text }]}>
                  Select the times you're available for chores
                </Text>
                
                {isInitialized ? (
                  <View style={styles.tableContainer}>
                    {/* Header row with time slots */}
                    <View style={styles.tableRow}>
                      <View style={styles.dayCell}>
                        <Text style={[styles.headerText, { color: theme.colors.text }]}>
                          Day / Time
                        </Text>
                      </View>
                      
                      {TIME_SLOTS.map(slot => (
                        <TouchableOpacity 
                          key={slot.id}
                          style={styles.timeSlotCell}
                          onPress={() => handleToggleAllForTimeSlot(slot.id)}
                        >
                          <Ionicons name={slot.icon} size={16} color={theme.colors.text} />
                          <Text 
                            numberOfLines={1}
                            style={[styles.timeSlotText, { color: theme.colors.text }]}
                          >
                            {slot.label.split(' ')[0]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      
                      <View style={styles.allCell}>
                        <Text style={[styles.headerText, { color: theme.colors.text }]}>All</Text>
                      </View>
                    </View>
                    
                    {/* Day rows */}
                    {DAYS.map(day => (
                      <View key={day.id} style={styles.tableRow}>
                        <View style={styles.dayCell}>
                          <Text style={[styles.dayText, { color: theme.colors.text }]}>
                            {day.label}
                          </Text>
                        </View>
                        
                        {TIME_SLOTS.map(slot => (
                          <TouchableOpacity
                            key={`${day.id}-${slot.id}`}
                            style={[
                              styles.availabilityCell,
                              availability[day.id]?.[slot.id] && styles.selectedCell
                            ]}
                            onPress={() => handleToggleTimeSlot(day.id, slot.id)}
                          >
                            {availability[day.id]?.[slot.id] && (
                              <Ionicons name="checkmark" size={18} color="#fff" />
                            )}
                          </TouchableOpacity>
                        ))}
                        
                        <TouchableOpacity
                          style={styles.allCell}
                          onPress={() => handleToggleAllForDay(day.id)}
                        >
                          <Ionicons 
                            name={TIME_SLOTS.every(slot => availability[day.id]?.[slot.id]) ? "checkbox" : "square-outline"} 
                            size={20} 
                            color={theme.colors.primary} 
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.errorContainer}>
                    <Text style={{ color: theme.colors.text }}>
                      Could not load availability data. Please try again.
                    </Text>
                  </View>
                )}
              </ScrollView>
              
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={saveAvailability}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.85,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  scrollContent: {
    flexGrow: 0,
    height: height * 0.5, // Fixed height ensures content is visible
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    height: 50, // Fixed height for rows
  },
  dayCell: {
    width: '25%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(150, 150, 150, 0.2)',
  },
  timeSlotCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(150, 150, 150, 0.2)',
  },
  timeSlotText: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  dayText: {
    fontSize: 12,
  },
  availabilityCell: {
    flex: 1,
    minHeight: 40, // Ensure cells have minimum height
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(150, 150, 150, 0.2)',
  },
  selectedCell: {
    backgroundColor: '#546DE5',
  },
  allCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#546DE5',
    minWidth: 100,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AvailabilityModal;
