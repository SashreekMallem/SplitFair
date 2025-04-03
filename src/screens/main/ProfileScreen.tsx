import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Share,
  Clipboard,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { useNotification } from '../../context/NotificationContext';
import { BlurView } from 'expo-blur';
import { logDebug, logError } from '../../utils/DebugHelper';
import { useNavigation } from '@react-navigation/native';
import HomeIsland, { IslandMode } from '../../components/HomeIsland';

const { width } = Dimensions.get('window');

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  profile_image_url?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
};

type HomeDetails = {
  id: string;
  name: string;
  invitation_code: string;
  street_address: string;
  unit?: string;
  city: string;
  state_province: string;
  zip_postal_code: string;
  country: string;
  monthly_rent: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date?: string;
  created_by: string;
};

type HomeMember = {
  id: string;
  user_id: string;
  home_id: string;
  role: string;
  rent_contribution: number;
  move_in_date: string;
  move_out_date?: string;
  joined_at: string;
  full_name?: string;
  email?: string;
  profile_image_url?: string;
};

const ProfileScreen: React.FC = () => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showNotification } = useNotification();
  const navigation = useNavigation();

  const [islandMode, setIslandMode] = useState<IslandMode>('summary');

  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [home, setHome] = useState<HomeDetails | null>(null);
  const [roommates, setRoommates] = useState<HomeMember[]>([]);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editedProfile, setEditedProfile] = useState<{
    full_name?: string;
    phone_number?: string;
  }>({});
  const [inviteModalVisible, setInviteModalVisible] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      if (!user) return;

      logDebug('Fetching user profile data');

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setEditedProfile({
        full_name: profileData.full_name,
        phone_number: profileData.phone_number || '',
      });

      const { data: memberData, error: memberError } = await supabase
        .from('home_members')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (memberError) {
        logError(`Error fetching home membership: ${memberError.message}`);
        setLoading(false);
        return;
      }

      const { data: homeData, error: homeError } = await supabase
        .from('homes')
        .select('*')
        .eq('id', memberData.home_id)
        .single();

      if (homeError) throw homeError;
      setHome(homeData);

      const { data: roommatesData, error: roommatesError } = await supabase
        .from('home_members')
        .select(`
          *,
          user_profiles:user_id(full_name, email, profile_image_url)
        `)
        .eq('home_id', homeData.id)
        .neq('user_id', user.id);

      if (roommatesError) throw roommatesError;

      const formattedRoommates = roommatesData.map((member: any) => ({
        ...member,
        full_name: member.user_profiles?.full_name || 'Unknown',
        email: member.user_profiles?.email || '',
        profile_image_url: member.user_profiles?.profile_image_url,
      }));

      setRoommates(formattedRoommates);

      logDebug('User data fetched successfully');
    } catch (error: any) {
      logError(`Error fetching user data: ${error.message}`);
      showNotification('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      if (!profile) return;
      setEditing(true);

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: editedProfile.full_name,
          phone_number: editedProfile.phone_number,
          updated_at: new Date(),
        })
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      setEditMode(false);
      showNotification('Success', 'Profile updated successfully', 'success');
    } catch (error: any) {
      logError(`Error updating profile: ${error.message}`);
      showNotification('Error', error.message, 'error');
    } finally {
      setEditing(false);
    }
  };

  const handleShareInviteCode = async () => {
    try {
      if (!home) return;

      const message = `Join my home on SplitFair! Use code: ${home.invitation_code}\n\nDownload the app: https://splitfair.app/`;

      const result = await Share.share({
        message,
        title: 'SplitFair Home Invitation',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          showNotification('Success', 'Invitation shared', 'success');
        }
      }
    } catch (error: any) {
      logError(`Error sharing invite code: ${error.message}`);
      showNotification('Error', 'Failed to share invitation', 'error');
    }
  };

  const handleCopyInviteCode = () => {
    if (!home) return;

    Clipboard.setString(home.invitation_code);
    showNotification('Copied', 'Invitation code copied to clipboard', 'success');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              showNotification('Success', 'Logged out successfully', 'success');
            } catch (error: any) {
              showNotification('Error', error.message, 'error');
            }
          },
        },
      ]
    );
  };

  const handleIslandAction = () => {
    switch (islandMode) {
      case 'summary':
        showNotification('Home Summary', 'Viewing detailed home overview', 'info');
        break;
      case 'expenses':
        showNotification('Payment', 'Processing payment...', 'success');
        break;
      case 'tasks':
        showNotification('Task', 'Task marked as completed', 'success');
        break;
      case 'schedule':
        showNotification('Reminder', 'Rent reminder set for 3 days before due date', 'info');
        break;
      case 'alert':
        showNotification('Payment', 'Resolving overdue payment...', 'warning');
        break;
      case 'furniture':
        showNotification('Furniture', 'Adding new shared item...', 'info');
        break;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="auto" />

      <LinearGradient
        colors={[
          isDarkMode ? 'rgba(84, 109, 229, 0.15)' : 'rgba(84, 109, 229, 0.08)',
          isDarkMode ? 'rgba(84, 109, 229, 0.05)' : 'rgba(84, 109, 229, 0.02)',
          'transparent'
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={styles.headerGradient}
      />

      <HomeIsland 
        mode={islandMode} 
        onModeChange={setIslandMode} 
        onActionPress={handleIslandAction}
        navigation={navigation}
        data={{
          expenses: [],
          tasks: [],
          events: [],
          furniture: []
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Platform.OS === 'ios' ? 120 : 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.themeToggle}
              onPress={toggleTheme}
            >
              <Ionicons
                name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Existing profile content */}
        {/* Profile card, home details, invitation code, roommates sections */}
      </ScrollView>

      {/* Invite Modal */}
      {/* Existing invite modal code */}
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
    height: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
  },
  themeToggle: {
    padding: 8,
    marginRight: 12,
  },
  logoutButton: {
    padding: 8,
  },
});

export default ProfileScreen;
