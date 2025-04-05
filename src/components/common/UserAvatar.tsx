import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

interface UserAvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
  style?: any;
  showBorder?: boolean;
  isCurrentUser?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  name, 
  size = 40, 
  imageUrl, 
  style = {}, 
  showBorder = false,
  isCurrentUser = false
}) => {
  const { isDarkMode } = useTheme();
  
  // Get initials from name
  const getInitials = (name: string) => {
    if (!name || name === 'You') return 'YU';
    
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Get a consistent color based on the name
  const getColorForName = (name: string) => {
    const colors = [
      ['#546DE5', '#8394EB'], // Blue
      ['#20BF6B', '#26DE81'], // Green
      ['#EB4D4B', '#FC5C65'], // Red
      ['#F7B731', '#FED330'], // Yellow
      ['#9B59B6', '#A55EEA'], // Purple
      ['#26C6DA', '#3DD2E0'], // Cyan
      ['#2980B9', '#3498DB'], // Sky Blue
      ['#16A085', '#1ABC9C'], // Turquoise
    ];
    
    // Special case for current user
    if (name === 'You' || isCurrentUser) {
      return ['#546DE5', '#8394EB']; // Always use blue for current user
    }
    
    // Generate a numerical hash of the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use the hash to pick a color
    const index = Math.abs(hash % colors.length);
    return colors[index];
  };
  
  // Determine avatar style
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: isDarkMode ? '#333' : '#eee',
    ...style,
  };
  
  // Border style if needed
  const borderStyle = showBorder ? {
    borderWidth: 2,
    borderColor: isCurrentUser ? '#546DE5' : isDarkMode ? '#444' : '#ddd',
  } : {};
  
  const initials = getInitials(name);
  const colors = getColorForName(name);
  
  return (
    <View style={[containerStyle, borderStyle]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
        />
      ) : (
        <LinearGradient
          colors={colors}
          style={styles.gradient}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
            {initials}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  gradient: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default UserAvatar;
