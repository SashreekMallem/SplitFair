import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PenaltyStatusBadgeProps {
  points: number;
  showIcon?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * A visual indicator for penalty points
 */
const PenaltyStatusBadge: React.FC<PenaltyStatusBadgeProps> = ({ 
  points, 
  showIcon = true,
  size = 'medium' 
}) => {
  // No points, don't show anything
  if (!points || points <= 0) return null;
  
  // Determine color based on points severity
  const getColor = () => {
    if (points >= 8) return '#EB4D4B'; // Red for severe
    if (points >= 5) return '#F7B731'; // Yellow for moderate
    if (points >= 3) return '#FF9855'; // Orange for mild
    return '#546DE5'; // Blue for minor
  };
  
  // Scale based on size
  const getSize = () => {
    switch (size) {
      case 'small': return { badge: 18, icon: 10, font: 10 };
      case 'large': return { badge: 32, icon: 18, font: 16 };
      default: return { badge: 24, icon: 14, font: 12 };
    }
  };
  
  const sizeValues = getSize();
  
  return (
    <View style={[
      styles.container,
      { backgroundColor: getColor() + '20' }
    ]}>
      {showIcon && (
        <View style={[
          styles.iconContainer,
          { 
            backgroundColor: getColor(),
            width: sizeValues.badge,
            height: sizeValues.badge,
            borderRadius: sizeValues.badge / 2,
          }
        ]}>
          <Ionicons name="alert" size={sizeValues.icon} color="white" />
        </View>
      )}
      <Text style={[
        styles.text,
        { 
          color: getColor(),
          fontSize: sizeValues.font 
        }
      ]}>
        {points} Penalty Point{points !== 1 ? 's' : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  text: {
    fontWeight: '600',
  }
});

export default PenaltyStatusBadge;
