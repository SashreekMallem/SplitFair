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

      // 1. Fetch user profile first
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        logError(`Profile fetch failed: ${profileError.message}`);
        throw profileError;
      }
      
      setProfile(profileData);
      setEditedProfile({
        full_name: profileData.full_name,
        phone_number: profileData.phone_number || '',
      });

      // 2. Use a simplified approach for fetching home membership to avoid recursion
      // Filter on the client side instead of using RLS policies with joins
      const { data: memberships, error: membershipsError } = await supabase
        .from('home_members')
        .select('*');
      
      if (membershipsError) {
        logError(`Failed to fetch memberships: ${membershipsError.message}`);
        setLoading(false);
        return;
      }
      
      // Client-side filtering
      const myMembership = memberships.find(m => m.user_id === user.id);
      if (!myMembership) {
        logError('No home membership found');
        setLoading(false);
        return;
      }

      // 3. Now fetch the home details
      const { data: homeData, error: homeError } = await supabase
        .from('homes')
        .select('*')
        .eq('id', myMembership.home_id)
        .single();

      if (homeError) {
        logError(`Home fetch failed: ${homeError.message}`);
        throw homeError;
      }
      setHome(homeData);

      // 4. Fetch roommates - FIXED: Separate queries instead of join
      try {
        // First get all members of the home except current user
        const { data: roommateMembers, error: memberError } = await supabase
          .from('home_members')
          .select('*')
          .eq('home_id', myMembership.home_id)
          .neq('user_id', user.id);

        if (memberError) {
          logError(`Error fetching roommate members: ${memberError.message}`);
          throw memberError;
        }

        // Now fetch profile data for each member
        const formattedRoommates = [];
        for (const member of roommateMembers) {
          const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('full_name, email, profile_image_url')
            .eq('user_id', member.user_id)
            .single();

          if (!profileError && userProfile) {
            formattedRoommates.push({
              ...member,
              full_name: userProfile.full_name || 'Unknown',
              email: userProfile.email || '',
              profile_image_url: userProfile.profile_image_url
            });
          } else {
            // Include member even if profile fetch fails
            formattedRoommates.push({
              ...member,
              full_name: 'Unknown User',
              email: '',
              profile_image_url: null
            });
          }
        }

        setRoommates(formattedRoommates);
        
      } catch (roomError: any) {
        logError(`Error fetching roommate details: ${roomError.message}`);
        // Continue despite roommate fetch error - don't block the whole profile
      }

      logDebug('User data fetched successfully');
    } catch (error: any) {
      logError(`Error in profile data fetch: ${error.message}`);
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

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.card }]}>
          {/* Profile header with avatar */}
          <View style={styles.profileHeader}>
            <View style={[
              styles.avatarContainer, 
              { borderColor: theme.colors.primary }
            ]}>
              {profile?.profile_image_url ? (
                <Image
                  source={{ uri: profile.profile_image_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.initialsAvatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.initialsText}>
                    {getInitials(profile?.full_name || 'User')}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.profileInfo}>
              {editMode ? (
                <TextInput
                  style={[styles.nameInput, { color: theme.colors.text }]}
                  value={editedProfile.full_name}
                  onChangeText={(text) => setEditedProfile(prev => ({ ...prev, full_name: text }))}
                  placeholder="Your name"
                  placeholderTextColor="#999"
                />
              ) : (
                <Text style={[styles.profileName, { color: theme.colors.text }]}>
                  {profile?.full_name || 'User'}
                </Text>
              )}
              
              <Text style={[styles.profileEmail, { color: isDarkMode ? '#bbb' : '#666' }]}>
                {profile?.email || user?.email || 'No email'}
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                if (editMode) {
                  handleUpdateProfile();
                } else {
                  setEditMode(true);
                }
              }}
              disabled={editing}
            >
              {editing ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons
                  name={editMode ? "checkmark" : "pencil-outline"}
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </TouchableOpacity>
          </View>
          
          {/* Profile details */}
          <View style={styles.profileDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="call-outline" size={20} color={theme.colors.primary} />
              {editMode ? (
                <TextInput
                  style={[styles.detailInput, { color: theme.colors.text }]}
                  value={editedProfile.phone_number}
                  onChangeText={(text) => setEditedProfile(prev => ({ ...prev, phone_number: text }))}
                  placeholder="Your phone number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={[styles.detailText, { color: theme.colors.text }]}>
                  {profile?.phone_number || 'No phone number'}
                </Text>
              )}
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.detailText, { color: theme.colors.text }]}>
                Joined {new Date(profile?.created_at || '').toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Home Information */}
        {home && (
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Home Details
            </Text>
            
            <View style={styles.homeDetails}>
              <View style={styles.homeTitleRow}>
                <Text style={[styles.homeTitle, { color: theme.colors.text }]}>
                  {home.name}
                </Text>
                
                <TouchableOpacity
                  style={styles.editHomeButton}
                  onPress={() => {
                    showNotification('Coming Soon', 'Home editing will be available soon', 'info');
                  }}
                >
                  <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.addressContainer}>
                <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                <View style={styles.addressDetails}>
                  <Text style={[styles.addressText, { color: theme.colors.text }]}>
                    {home.street_address}{home.unit ? `, ${home.unit}` : ''}
                  </Text>
                  <Text style={[styles.addressText, { color: theme.colors.text }]}>
                    {home.city}, {home.state_province} {home.zip_postal_code}
                  </Text>
                  <Text style={[styles.addressText, { color: theme.colors.text }]}>
                    {home.country}
                  </Text>
                </View>
              </View>
              
              <View style={styles.homeInfoRow}>
                {/* ...more home details... */}
              </View>
            </View>
          </View>
        )}
        
        {/* Invitation Code */}
        {home && (
          <View style={[styles.inviteCard, { backgroundColor: theme.colors.primary }]}>
            {/* ...invitation code content... */}
          </View>
        )}
        
        {/* Roommates Section */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>
          {/* ...roommates content... */}
        </View>
        
        {/* App Info */}
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5' }]}>
          <Text style={[styles.infoText, { color: isDarkMode ? '#bbb' : '#666' }]}>
            SplitFair v1.0.0
          </Text>
        </View>
      </ScrollView>
      
      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        {/* ...modal content... */}
      </Modal>
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
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  initialsAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  editButton: {
    padding: 8,
  },
  profileDetails: {
    marginTop: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 16,
  },
  detailInput: {
    marginLeft: 8,
    fontSize: 16,
    flex: 1,
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  homeDetails: {
    marginTop: 8,
  },
  homeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  editHomeButton: {
    padding: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressDetails: {
    marginLeft: 8,
  },
  addressText: {
    fontSize: 14,
  },
  homeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  inviteCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
  },
  infoCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ProfileScreen;
