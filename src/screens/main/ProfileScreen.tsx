import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { logDebug, logError } from '../../utils/DebugHelper';
import { useNavigation } from '@react-navigation/native';
import HomeIsland, { IslandMode } from '../../components/HomeIsland';
import { fetchUserProfile, updateUserProfile, UserProfile } from '../../services/api/userService';
import { fetchUserHome, fetchHomeMembers, updateHomeDetails, HomeDetails, HomeMember, removeHouseMember, leaveHome } from '../../services/api/homeService';

const { width } = Dimensions.get('window');

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
  const [editing, setEditing] = useState<boolean>(false);

  const [editHomeMode, setEditHomeMode] = useState<boolean>(false);
  const [editedHome, setEditedHome] = useState<Partial<HomeDetails>>({});
  const [savingHome, setSavingHome] = useState<boolean>(false);

  const [userRole, setUserRole] = useState<string>('member');

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      if (!user) return;

      logDebug('Fetching user profile data');

      const profileData = await fetchUserProfile(user.id);
      if (!profileData) {
        logError('Failed to fetch user profile');
        throw new Error('Failed to fetch profile');
      }

      setProfile(profileData);
      setEditedProfile({
        full_name: profileData.full_name,
        phone_number: profileData.phone_number || '',
      });

      const homeData = await fetchUserHome(user.id);
      if (!homeData) {
        logError('No home data found');
        setLoading(false);
        return;
      }
      setHome(homeData);

      const roommatesData = await fetchHomeMembers(homeData.id, user.id);
      setRoommates(roommatesData);

      const isOwner = homeData.created_by === user.id;
      setUserRole(isOwner ? 'owner' : 'member');

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
      if (!profile || !user) return;
      setEditing(true);

      const updatedProfile = await updateUserProfile(user.id, {
        full_name: editedProfile.full_name,
        phone_number: editedProfile.phone_number,
      });

      if (!updatedProfile) {
        throw new Error('Failed to update profile');
      }

      setProfile(updatedProfile);
      setEditMode(false);
      showNotification('Success', 'Profile updated successfully', 'success');
    } catch (error: any) {
      logError(`Error updating profile: ${error.message}`);
      showNotification('Error', error.message, 'error');
    } finally {
      setEditing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
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
    ]);
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

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      'Remove Roommate',
      `Are you sure you want to remove ${memberName} from your home?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!home) return;

              const result = await removeHouseMember(home.id, memberId);

              if (result.success) {
                showNotification('Success', `${memberName} has been removed from your home`, 'success');
                fetchUserData();
              } else {
                showNotification('Error', result.error || 'Failed to remove roommate', 'error');
              }
            } catch (error: any) {
              logError(`Error removing roommate: ${error.message}`);
              showNotification('Error', error.message, 'error');
            }
          },
        },
      ]
    );
  };

  const handleLeaveHome = () => {
    Alert.alert(
      'Leave Home',
      'Are you sure you want to leave this home? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!home || !user) return;

              const result = await leaveHome(home.id, user.id);

              if (result.success) {
                showNotification('Success', 'You have left the home', 'success');
                navigation.goBack();
              } else {
                showNotification('Error', result.error || 'Failed to leave home', 'error');
              }
            } catch (error: any) {
              logError(`Error leaving home: ${error.message}`);
              showNotification('Error', error.message, 'error');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const SectionHeader = ({
    title,
    icon,
    action,
  }: {
    title: string;
    icon?: string;
    action?: () => void;
  }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && (
          <View
            style={[
              styles.sectionHeaderIcon,
              { backgroundColor: theme.colors.primary + '20' },
            ]}
          >
            <Ionicons name={icon as any} size={18} color={theme.colors.primary} />
          </View>
        )}
        <Text style={[styles.sectionHeaderTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionHeaderAction}>
          <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const toggleHomeEditMode = () => {
    if (editHomeMode) {
      setEditedHome({});
      setEditHomeMode(false);
    } else {
      if (home) {
        setEditedHome({
          name: home.name,
          street_address: home.street_address,
          unit: home.unit,
          city: home.city,
          state_province: home.state_province,
          zip_postal_code: home.zip_postal_code,
          country: home.country,
          monthly_rent: home.monthly_rent,
          security_deposit: home.security_deposit,
          lease_start_date: home.lease_start_date,
          lease_end_date: home.lease_end_date,
        });
      }
      setEditHomeMode(true);
    }
  };

  const saveHomeDetails = async () => {
    if (!home) return;

    try {
      setSavingHome(true);

      const numericUpdates = {
        ...editedHome,
        monthly_rent: typeof editedHome.monthly_rent === 'string'
          ? parseFloat(editedHome.monthly_rent as string)
          : editedHome.monthly_rent,
        security_deposit: typeof editedHome.security_deposit === 'string'
          ? parseFloat(editedHome.security_deposit as string)
          : editedHome.security_deposit,
      };

      const updatedHome = await updateHomeDetails(home.id, numericUpdates);

      if (!updatedHome) {
        throw new Error('Failed to update home details');
      }

      setHome(updatedHome);
      setEditHomeMode(false);
      setEditedHome({});
      showNotification('Success', 'Home details updated successfully', 'success');
    } catch (error: any) {
      logError(`Error updating home details: ${error.message}`);
      showNotification('Error', error.message, 'error');
    } finally {
      setSavingHome(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading profile...
        </Text>
      </View>
    );
  }

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
        end={{ x: 0, y: 0.5 }}
        style={styles.headerGradient}
      />

      <View style={styles.islandContainer}>
        <HomeIsland
          mode={islandMode}
          onModeChange={setIslandMode}
          onActionPress={handleIslandAction}
          navigation={navigation}
          profile={profile}
          homeData={home}
          contextMode="profile"
          onBackPress={handleBackPress}
          onThemeToggle={toggleTheme}
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          data={{
            expenses: [],
            tasks: [],
            events: [],
            furniture: [],
          }}
        />
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <Animated.View
          style={[
            styles.profileHeroCard,
            {
              backgroundColor: theme.colors.card,
              opacity: fadeInAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <View style={styles.profileHero}>
            <View
              style={[
                styles.avatarContainer,
                {
                  borderColor: theme.colors.primary,
                  shadowColor: theme.colors.primary,
                },
              ]}
            >
              {profile?.profile_image_url ? (
                <Image
                  source={{ uri: profile.profile_image_url }}
                  style={styles.avatar}
                />
              ) : (
                <LinearGradient
                  colors={[
                    theme.colors.primary,
                    isDarkMode ? '#7B6FE6' : '#6C63FF',
                  ]}
                  style={styles.initialsAvatar}
                >
                  <Text style={styles.initialsText}>
                    {getInitials(profile?.full_name || 'User')}
                  </Text>
                </LinearGradient>
              )}
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameEditContainer}>
                {editMode ? (
                  <TextInput
                    style={[styles.nameInput, { color: theme.colors.text }]}
                    value={editedProfile.full_name}
                    onChangeText={(text) =>
                      setEditedProfile((prev) => ({ ...prev, full_name: text }))
                    }
                    placeholder="Your name"
                    placeholderTextColor="#999"
                  />
                ) : (
                  <Text style={[styles.profileName, { color: theme.colors.text }]}>
                    {profile?.full_name || 'User'}
                  </Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.inlineEditButton,
                    editMode
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' },
                  ]}
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
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons
                      name={editMode ? 'checkmark' : 'pencil'}
                      size={editMode ? 18 : 16}
                      color={editMode ? '#fff' : theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[styles.profileEmail, { color: isDarkMode ? '#bbb' : '#666' }]}>
                {profile?.email || user?.email || 'No email'}
              </Text>

              <View style={styles.profileBadges}>
                <View
                  style={[
                    styles.profileBadge,
                    { backgroundColor: theme.colors.primary + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.profileBadgeText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {home?.id ? 'Home Member' : 'No Home'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.profileBadge,
                    { backgroundColor: isDarkMode ? '#333' : '#f5f5f5' },
                  ]}
                >
                  <Text
                    style={[
                      styles.profileBadgeText,
                      { color: isDarkMode ? '#bbb' : '#666' },
                    ]}
                  >
                    Joined {new Date(profile?.created_at || '').toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <SectionHeader title="Contact Information" icon="person" />

            <View style={styles.detailItem}>
              <View
                style={[
                  styles.detailIconContainer,
                  { backgroundColor: theme.colors.primary + '15' },
                ]}
              >
                <Ionicons name="call-outline" size={18} color={theme.colors.primary} />
              </View>

              {editMode ? (
                <TextInput
                  style={[styles.detailInput, { color: theme.colors.text }]}
                  value={editedProfile.phone_number}
                  onChangeText={(text) =>
                    setEditedProfile((prev) => ({ ...prev, phone_number: text }))
                  }
                  placeholder="Add phone number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              ) : (
                <>
                  <View style={styles.detailTextContainer}>
                    <Text
                      style={[
                        styles.detailLabel,
                        { color: isDarkMode ? '#999' : '#666' },
                      ]}
                    >
                      Phone Number
                    </Text>
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      {profile?.phone_number || 'Not provided'}
                    </Text>
                  </View>
                  {!editMode && (
                    <Ionicons
                      name={profile?.phone_number ? 'call' : 'add-circle-outline'}
                      size={22}
                      color={
                        profile?.phone_number
                          ? theme.colors.primary
                          : isDarkMode
                          ? '#999'
                          : '#666'
                      }
                      style={styles.detailAction}
                    />
                  )}
                </>
              )}
            </View>

            <View style={styles.detailItem}>
              <View
                style={[styles.detailIconContainer, { backgroundColor: '#4267B215' }]}
              >
                <Ionicons name="mail-outline" size={18} color="#4267B2" />
              </View>

              <View style={styles.detailTextContainer}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: isDarkMode ? '#999' : '#666' },
                  ]}
                >
                  Email
                </Text>
                <Text style={[styles.detailText, { color: theme.colors.text }]}>
                  {profile?.email || user?.email || 'No email'}
                </Text>
              </View>

              <Ionicons name="mail" size={22} color="#4267B2" style={styles.detailAction} />
            </View>
          </View>
        </Animated.View>

        {home && (
          <Animated.View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.card,
                opacity: fadeInAnim,
                transform: [{ translateY: translateYAnim }],
              },
            ]}
          >
            <SectionHeader
              title="Home Details"
              icon="home"
              action={toggleHomeEditMode}
            />

            <View style={styles.homeDetails}>
              <View style={styles.detailItem}>
                <View
                  style={[
                    styles.detailIconContainer,
                    { backgroundColor: theme.colors.primary + '15' },
                  ]}
                >
                  <Ionicons name="business-outline" size={18} color={theme.colors.primary} />
                </View>

                <View style={styles.detailTextContainer}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: isDarkMode ? '#999' : '#666' },
                    ]}
                  >
                    Home Name
                  </Text>
                  {editHomeMode ? (
                    <TextInput
                      style={[styles.detailInput, { color: theme.colors.text }]}
                      value={editedHome.name?.toString()}
                      onChangeText={(text) => setEditedHome(prev => ({ ...prev, name: text }))}
                      placeholder="Enter home name"
                      placeholderTextColor="#999"
                    />
                  ) : (
                    <Text style={[styles.detailText, { color: theme.colors.text }]}>
                      {home.name}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.detailItem}>
                <View
                  style={[
                    styles.detailIconContainer,
                    { backgroundColor: '#4CD97D15' },
                  ]}
                >
                  <Ionicons name="location-outline" size={18} color="#4CD97D" />
                </View>

                <View style={styles.detailTextContainer}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: isDarkMode ? '#999' : '#666' },
                    ]}
                  >
                    Address
                  </Text>

                  {editHomeMode ? (
                    <>
                      <TextInput
                        style={[styles.detailInput, { color: theme.colors.text, marginBottom: 8 }]}
                        value={editedHome.street_address?.toString()}
                        onChangeText={(text) => setEditedHome(prev => ({ ...prev, street_address: text }))}
                        placeholder="Street address"
                        placeholderTextColor="#999"
                      />

                      <View style={styles.rowContainer}>
                        <TextInput
                          style={[styles.detailInputHalf, { color: theme.colors.text }]}
                          value={editedHome.unit?.toString() || ''}
                          onChangeText={(text) => setEditedHome(prev => ({ ...prev, unit: text }))}
                          placeholder="Unit/Apt (optional)"
                          placeholderTextColor="#999"
                        />

                        <TextInput
                          style={[styles.detailInputHalf, { color: theme.colors.text }]}
                          value={editedHome.city?.toString()}
                          onChangeText={(text) => setEditedHome(prev => ({ ...prev, city: text }))}
                          placeholder="City"
                          placeholderTextColor="#999"
                        />
                      </View>

                      <View style={[styles.rowContainer, { marginTop: 8 }]}>
                        <TextInput
                          style={[styles.detailInputHalf, { color: theme.colors.text }]}
                          value={editedHome.state_province?.toString()}
                          onChangeText={(text) => setEditedHome(prev => ({ ...prev, state_province: text }))}
                          placeholder="State/Province"
                          placeholderTextColor="#999"
                        />

                        <TextInput
                          style={[styles.detailInputHalf, { color: theme.colors.text }]}
                          value={editedHome.zip_postal_code?.toString()}
                          onChangeText={(text) => setEditedHome(prev => ({ ...prev, zip_postal_code: text }))}
                          placeholder="ZIP/Postal Code"
                          placeholderTextColor="#999"
                        />
                      </View>

                      <TextInput
                        style={[styles.detailInput, { color: theme.colors.text, marginTop: 8 }]}
                        value={editedHome.country?.toString()}
                        onChangeText={(text) => setEditedHome(prev => ({ ...prev, country: text }))}
                        placeholder="Country"
                        placeholderTextColor="#999"
                      />
                    </>
                  ) : (
                    <>
                      <Text style={[styles.detailText, { color: theme.colors.text }]}>
                        {home.street_address}
                        {home.unit ? `, ${home.unit}` : ''}
                      </Text>
                      <Text style={[styles.detailText, { color: theme.colors.text }]}>
                        {home.city}, {home.state_province} {home.zip_postal_code}
                      </Text>
                      <Text style={[styles.detailText, { color: theme.colors.text }]}>
                        {home.country}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.homeFinancials}>
                <View style={styles.financialItem}>
                  {editHomeMode ? (
                    <View style={styles.financialEditItem}>
                      <Text style={styles.financialLabel}>Monthly Rent</Text>
                      <TextInput
                        style={[styles.financialInput, { color: theme.colors.text }]}
                        value={editedHome.monthly_rent?.toString()}
                        onChangeText={(text) => setEditedHome(prev => ({ ...prev, monthly_rent: text }))}
                        placeholder="0.00"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.financialValue}>
                        ${home.monthly_rent.toFixed(0)}
                      </Text>
                      <Text style={styles.financialLabel}>Monthly Rent</Text>
                    </>
                  )}
                </View>

                <View style={styles.financialItem}>
                  {editHomeMode ? (
                    <View style={styles.financialEditItem}>
                      <Text style={styles.financialLabel}>Security Deposit</Text>
                      <TextInput
                        style={[styles.financialInput, { color: theme.colors.text }]}
                        value={editedHome.security_deposit?.toString()}
                        onChangeText={(text) => setEditedHome(prev => ({ ...prev, security_deposit: text }))}
                        placeholder="0.00"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.financialValue}>
                        ${home.security_deposit.toFixed(0)}
                      </Text>
                      <Text style={styles.financialLabel}>Security Deposit</Text>
                    </>
                  )}
                </View>

                <View style={styles.financialItem}>
                  {editHomeMode ? (
                    <View style={styles.financialEditItem}>
                      <Text style={styles.financialLabel}>Lease Start</Text>
                      <TextInput
                        style={[styles.financialInput, { color: theme.colors.text }]}
                        value={editedHome.lease_start_date}
                        onChangeText={(text) => setEditedHome(prev => ({ ...prev, lease_start_date: text }))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#999"
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.financialValue}>
                        {new Date(home.lease_start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.financialLabel}>Lease Start</Text>
                    </>
                  )}
                </View>

                <View style={styles.financialItem}>
                  {editHomeMode ? (
                    <View style={styles.financialEditItem}>
                      <Text style={styles.financialLabel}>Lease End</Text>
                      <TextInput
                        style={[styles.financialInput, { color: theme.colors.text }]}
                        value={editedHome.lease_end_date || ''}
                        onChangeText={(text) => setEditedHome(prev => ({ ...prev, lease_end_date: text }))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#999"
                      />
                    </View>
                  ) : (
                    home.lease_end_date ? (
                      <>
                        <Text style={styles.financialValue}>
                          {new Date(home.lease_end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        <Text style={styles.financialLabel}>Lease End</Text>
                      </>
                    ) : (
                      <TouchableOpacity 
                        style={styles.addLeaseEndButton}
                        onPress={toggleHomeEditMode}
                      >
                        <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                        <Text style={[styles.financialLabel, {color: theme.colors.primary}]}>Add Lease End</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              {editHomeMode && (
                <View style={styles.editButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.editButton, styles.cancelButton]}
                    onPress={toggleHomeEditMode}
                    disabled={savingHome}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.editButton, styles.saveButton]}
                    onPress={saveHomeDetails}
                    disabled={savingHome}
                  >
                    {savingHome ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {roommates.length > 0 && (
          <Animated.View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.card,
                opacity: fadeInAnim,
                transform: [{ translateY: translateYAnim }],
              },
            ]}
          >
            <SectionHeader title="Roommates" icon="people" />

            {roommates.map((roommate, index) => (
              <View
                key={roommate.id}
                style={[
                  styles.roommateItem,
                  index < roommates.length - 1 && styles.roommateItemBorder,
                ]}
              >
                <View style={styles.roommateAvatar}>
                  {roommate.profile_image_url ? (
                    <Image
                      source={{ uri: roommate.profile_image_url }}
                      style={styles.roommatePic}
                    />
                  ) : (
                    <LinearGradient
                      colors={
                        roommate.role === 'owner'
                          ? ['#FFA726', '#FB8C00']
                          : ['#78A3FF', '#5C8AFF']
                      }
                      style={styles.roommateInitials}
                    >
                      <Text style={styles.roommateInitialsText}>
                        {getInitials(roommate.full_name || 'User')}
                      </Text>
                    </LinearGradient>
                  )}
                </View>

                <View style={styles.roommateInfo}>
                  <View style={styles.roommateNameRow}>
                    <Text style={[styles.roommateName, { color: theme.colors.text }]}>
                      {roommate.full_name}
                    </Text>

                    <View
                      style={[
                        styles.roommateRoleBadge,
                        {
                          backgroundColor:
                            roommate.role === 'owner' ? '#FFA72620' : '#78A3FF20',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roommateRoleText,
                          {
                            color:
                              roommate.role === 'owner' ? '#FFA726' : '#78A3FF',
                          },
                        ]}
                      >
                        {roommate.role.charAt(0).toUpperCase() +
                          roommate.role.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.roommateDetails}>
                    <View style={styles.roommateDetailItem}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={isDarkMode ? '#bbb' : '#666'}
                      />
                      <Text
                        style={[
                          styles.roommateDetailText,
                          { color: isDarkMode ? '#bbb' : '#666' },
                        ]}
                      >
                        Since{' '}
                        {new Date(roommate.joined_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.roommateAction}
                  onPress={() => userRole === 'owner' ? 
                    handleRemoveMember(roommate.id, roommate.full_name || 'User') : 
                    null}
                >
                  {userRole === 'owner' && (
                    <Ionicons
                      name="person-remove-outline"
                      size={20}
                      color="#FF6B6B"
                    />
                  )}
                  {userRole !== 'owner' && (
                    <Ionicons
                      name="ellipsis-vertical"
                      size={20}
                      color={isDarkMode ? '#999' : '#777'}
                    />
                  )}
                </TouchableOpacity>
              </View>
            ))}

            {userRole !== 'owner' && (
              <TouchableOpacity
                style={styles.leaveHomeButton}
                onPress={handleLeaveHome}
              >
                <Ionicons name="exit-outline" size={18} color="#FF6B6B" />
                <Text style={styles.leaveHomeText}>Leave This Home</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        <View style={[styles.footer, { backgroundColor: 'transparent' }]}>
          <View style={styles.appVersion}>
            <Text style={[styles.versionText, { color: isDarkMode ? '#777' : '#999' }]}>
              SplitFair v1.0.0
            </Text>
          </View>

          <TouchableOpacity style={styles.supportButton}>
            <Text style={[styles.supportText, { color: theme.colors.primary }]}>
              Need Help?
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
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
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  islandContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 90,
    left: 0,
    right: 0,
    zIndex: 50,
    alignItems: 'center',
  },
  profileHeroCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  initialsAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 20,
  },
  nameEditContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
  },
  inlineEditButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  profileBadges: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  profileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  profileDetails: {
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeaderAction: {
    padding: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 15,
    fontWeight: '500',
  },
  detailAction: {
    paddingHorizontal: 8,
  },
  detailInput: {
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailInputHalf: {
    width: '48%',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  homeDetails: {},
  homeFinancials: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 10,
  },
  financialItem: {
    width: '48%',
    height: 90,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  financialValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5C8AFF',
    marginBottom: 4,
  },
  financialLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  financialEditItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  financialInput: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 6,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.3)',
    width: '90%',
    marginTop: 4,
  },
  addLeaseEndButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  roommateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  roommateItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  roommateAvatar: {
    marginRight: 16,
  },
  roommatePic: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  roommateInitials: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roommateInitialsText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  roommateInfo: {
    flex: 1,
  },
  roommateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roommateName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  roommateRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roommateRoleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  roommateDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  roommateDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 4,
  },
  roommateDetailText: {
    fontSize: 13,
    marginLeft: 4,
  },
  roommateAction: {
    padding: 8,
  },
  leaveHomeButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
  },
  leaveHomeText: {
    color: '#FF6B6B',
    fontWeight: '500',
    marginLeft: 8,
  },
  footer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  appVersion: {
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
  },
  supportButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  supportText: {
    fontSize: 14,
    fontWeight: '500',
  },
  editButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  editButton: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#5C8AFF',
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    marginRight: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ProfileScreen;
