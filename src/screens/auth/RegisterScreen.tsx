import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../config/supabase';
import DynamicIsland from '../../components/DynamicIsland';
import DatePicker from '../../components/DatePicker';
import { logDebug, logError } from '../../utils/DebugHelper';

const { width, height } = Dimensions.get('window');

// Debug helper for animations
const DEBUG_ANIMATIONS = true;
function logAnimation(message: string) {
  if (DEBUG_ANIMATIONS) {
    console.log(`[Animation Debug] ${message}`);
  }
}

// Enhanced debugging for Supabase operations
function logSupabaseOperation(operation: string, details?: any) {
  console.log(`[Supabase] ${operation}`, details ? JSON.stringify(details) : '');
}

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type RegisterScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

// Enhanced step indicator with animation
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    logAnimation(`Step Indicator animation - currentStep: ${currentStep}`);
    Animated.timing(animatedValue, {
      toValue: (currentStep - 1) / (totalSteps - 1),
      duration: 500,
      useNativeDriver: false,
    }).start(() => logAnimation('Step animation completed'));
  }, [currentStep]);

  const progressWidth = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.stepIndicatorContainer}>
      <View style={styles.progressBackground}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.stepsContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= currentStep;
          const isCompleted = stepNumber < currentStep;

          let stepLabel = "Personal";
          if (stepNumber === 2) stepLabel = "Address";
          if (stepNumber === 3) stepLabel = "Housing";

          return (
            <View key={index} style={styles.stepItemContainer}>
              <View style={[
                styles.stepDot,
                isActive && styles.activeDot,
              ]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={[
                    styles.stepNumber,
                    isActive && styles.activeStepNumber
                  ]}>
                    {stepNumber}
                  </Text>
                )}
              </View>
              <Text style={[
                styles.stepLabel,
                isActive && styles.activeStepLabel
              ]}>
                {stepLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { signUp } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [streetAddress, setStreetAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('');

  const [rent, setRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [moveInDate, setMoveInDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [joinExistingHome, setJoinExistingHome] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');

  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const [notification, setNotification] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  useEffect(() => {
    logAnimation('Initial animations starting');
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]).start(() => logAnimation('Initial animations completed'));
  }, []);

  useEffect(() => {
    logAnimation(`Step transition animation - currentStep: ${currentStep}`);
    const currentSlideAnim = slideAnim;

    Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(currentSlideAnim, {
        toValue: currentStep === 1 ? -50 : 50,
        duration: 0,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.parallel([
        Animated.timing(currentSlideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ])
    ]).start(() => logAnimation('Step transition animation completed'));
  }, [currentStep]);

  const showNotification = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({
      visible: true,
      title,
      message,
      type,
    });

    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const validateStep1 = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!streetAddress.trim()) {
      Alert.alert('Error', 'Please enter your street address');
      return false;
    }
    if (!city.trim()) {
      Alert.alert('Error', 'Please enter your city');
      return false;
    }
    if (!state.trim()) {
      Alert.alert('Error', 'Please enter your state/province');
      return false;
    }
    if (!zipCode.trim()) {
      Alert.alert('Error', 'Please enter your ZIP/postal code');
      return false;
    }
    if (!country.trim()) {
      Alert.alert('Error', 'Please enter your country');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!rent.trim() || isNaN(Number(rent))) {
      Alert.alert('Error', 'Please enter a valid rent amount');
      return false;
    }
    if (!securityDeposit.trim() || isNaN(Number(securityDeposit))) {
      Alert.alert('Error', 'Please enter a valid security deposit amount');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const createOrJoinHome = async (userId: string) => {
    try {
      logDebug(`Starting createOrJoinHome for user ${userId}`);
      logDebug(`Join existing home: ${joinExistingHome}`);
      
      // Get fresh auth session to ensure we have proper permissions
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      logSupabaseOperation('Current session', { 
        userId: currentUserId, 
        isCurrentUser: currentUserId === userId,
        accessToken: session?.access_token ? 'Present' : 'Missing'
      });
      
      if (joinExistingHome) {
        logDebug(`Looking up home with invitation code: ${invitationCode}`);
        const { data: homeData, error: homeError } = await supabase
          .from('homes')
          .select('*')
          .eq('invitation_code', invitationCode.toUpperCase())
          .single();

        if (homeError || !homeData) {
          logError(`Home lookup failed: ${homeError?.message || 'No home found'}`);
          showNotification('Invalid Code', 'Please check your invitation code and try again.', 'error');
          throw new Error('Invalid invitation code. Please check and try again.');
        }

        logDebug(`Found home: ${homeData.id}`);
        
        // Check if user is already a member
        const { data: existingMember } = await supabase
          .from('home_members')
          .select('*')
          .eq('home_id', homeData.id)
          .eq('user_id', userId)
          .single();
          
        if (existingMember) {
          logDebug('User is already a member of this home');
          return homeData;
        }

        logDebug(`Adding user ${userId} to home ${homeData.id}`);
        const { error: joinError } = await supabase.from('home_members').insert({
          home_id: homeData.id,
          user_id: userId,
          role: 'member',
          rent_contribution: 0,
          move_in_date: moveInDate || new Date().toISOString().split('T')[0]
        });

        if (joinError) {
          logError(`Error joining home: ${joinError.message}`);
          throw joinError;
        }

        return homeData;
      } else {
        logDebug('Creating new home');
        const homeData = {
          name: `${name}'s Home`,
          street_address: streetAddress,
          unit: unit,
          city: city,
          state_province: state,
          zip_postal_code: zipCode,
          country: country,
          monthly_rent: parseFloat(rent),
          security_deposit: parseFloat(securityDeposit),
          lease_start_date: moveInDate || new Date().toISOString().split('T')[0],
          created_by: userId,
          invitation_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        };

        // Step 1: Create the home using RPC (this works)
        logSupabaseOperation('1. Using RPC to create home', homeData);
        const { data: rpcResult, error: rpcError } = await supabase.rpc('insert_home', homeData);
        
        if (rpcError) {
          logError(`RPC home creation failed: ${rpcError.message}`);
          throw rpcError;
        }
        
        logSupabaseOperation('1. RPC result', rpcResult);
        const homeId = rpcResult.home_id;
        
        // Step 2: Test if we can read the home (this might fail)
        logSupabaseOperation('2. Testing if we can read the home');
        try {
          const { data: homeCheck, error: readError } = await supabase
            .from('homes')
            .select('*')
            .eq('id', homeId)
            .single();
            
          logSupabaseOperation('2. Home read result', homeCheck || readError);
          
          if (readError) {
            logError(`Cannot read home after creation: ${readError.message}`);
            logSupabaseOperation('2a. This suggests the "View homes created by user" policy is not working');
          }
        } catch (testError: any) {
          logError(`Test read failed: ${testError.message}`);
        }
        
        // Step 3: Try to create home_member using RPC instead
        logSupabaseOperation('3. Creating home_member using RPC');
        const homeMemberData = {
          home_id: homeId,
          user_id: userId,
          role: 'owner',
          rent_contribution: parseFloat(rent),
          move_in_date: moveInDate || new Date().toISOString().split('T')[0]
        };
        
        try {
          // Use an RPC function for inserting home members too
          const { data: memberResult, error: memberError } = await supabase.rpc('insert_home_member', homeMemberData);
          
          logSupabaseOperation('3. Member creation result', memberResult || memberError);
          
          if (memberError) {
            logError(`Member creation RPC failed: ${memberError.message}`);
          }
        } catch (memberError: any) {
          logError(`Error in home_member RPC: ${memberError.message}`);
          // Continue despite error - we'll try direct insert next
        }
        
        // Step 4: Try direct insert as fallback
        logSupabaseOperation('4. Trying direct insert of home_member');
        const { data: insertedMember, error: directError } = await supabase.from('home_members').insert(homeMemberData);
        
        logSupabaseOperation('4. Direct insert result', insertedMember || directError);
        
        if (directError) {
          logError(`Direct member insert failed: ${directError.message}`);
          logSupabaseOperation('4a. This suggests the "Insert home membership" policy is failing');
        }

        // Return what we can regardless of errors
        return {
          id: homeId,
          name: homeData.name,
          invitation_code: homeData.invitation_code,
          street_address: homeData.street_address,
          created_by: userId,
          membershipError: directError?.message
        };
      }
    } catch (error: any) {
      logError(`Error in createOrJoinHome: ${error.message}`);
      console.error('Error creating/joining home:', error);
      throw error;
    }
  };

  const handleRegistration = async () => {
    if (joinExistingHome && !invitationCode) {
      showNotification('Missing Code', 'Please enter a valid invitation code', 'warning');
      return;
    }

    if (!joinExistingHome && !validateStep3()) return;

    setLoading(true);
    try {
      // Store credentials for auto-login
      const credentials = {
        email,
        password
      };
      
      logDebug('Starting user registration process');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('User creation failed');

      logDebug(`User created with ID: ${userId}. Creating profile...`);
      
      // Create profile, home, etc...
      const { error: profileError } = await supabase.from('user_profiles').insert([{
        user_id: userId,
        full_name: name,
        email: email,
        created_at: new Date()
      }]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Failed to create user profile. ${profileError.message}`);
      }

      const home = await createOrJoinHome(userId);

      // Show success message
      showNotification(
        'Registration Successful',
        joinExistingHome ? 'You have joined the home successfully!' : 'Your home has been created successfully!',
        'success'
      );

      // Instead of redirecting to login screen, auto-login the user
      logDebug('Auto-logging in after successful registration');
      try {
        // Clear previous session first to avoid conflicts
        await supabase.auth.signOut();
        
        const { error: signInError } = await supabase.auth.signInWithPassword(credentials);
        
        if (signInError) {
          logError(`Auto-login failed: ${signInError.message}`);
          // If auto-login fails, redirect to login screen as fallback
          setTimeout(() => {
            navigation.navigate('Login');
          }, 2000);
        }
        // No need to navigate anywhere if login successful - AuthContext will handle it
      } catch (loginError: any) {
        logError(`Error during auto-login: ${loginError.message}`);
        // Redirect to login screen as fallback
        setTimeout(() => {
          navigation.navigate('Login');
        }, 2000);
      }
    } catch (error: any) {
      showNotification('Registration Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderFormStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Personal Information</Text>

            <View style={[
              styles.inputContainer,
              focusedField === 'name' && styles.inputContainerFocused,
            ]}>
              <Ionicons
                name="person-outline"
                size={20}
                color={focusedField === 'name' ? theme.colors.primary : '#999'}
              />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={[
              styles.inputContainer,
              focusedField === 'email' && styles.inputContainerFocused,
            ]}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={focusedField === 'email' ? theme.colors.primary : '#999'}
              />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={[
              styles.inputContainer,
              focusedField === 'password' && styles.inputContainerFocused,
            ]}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={focusedField === 'password' ? theme.colors.primary : '#999'}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
                style={styles.eyeIconButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            <View style={[
              styles.inputContainer,
              focusedField === 'confirmPassword' && styles.inputContainerFocused,
            ]}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={focusedField === 'confirmPassword' ? theme.colors.primary : '#999'}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3a7bd5', '#546DE5', '#778BEB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
              >
                <Text style={styles.buttonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.arrowIcon} />
              </LinearGradient>
            </TouchableOpacity>
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Address Information</Text>

            <View style={[
              styles.inputContainer,
              focusedField === 'streetAddress' && styles.inputContainerFocused,
            ]}>
              <Ionicons
                name="map-outline"
                size={20}
                color={focusedField === 'streetAddress' ? theme.colors.primary : '#999'}
              />
              <TextInput
                style={styles.input}
                placeholder="Street Address"
                placeholderTextColor="#999"
                value={streetAddress}
                onChangeText={setStreetAddress}
                onFocus={() => setFocusedField('streetAddress')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={[
              styles.inputContainer,
              focusedField === 'unit' && styles.inputContainerFocused,
            ]}>
              <Ionicons
                name="home-outline"
                size={20}
                color={focusedField === 'unit' ? theme.colors.primary : '#999'}
              />
              <TextInput
                style={styles.input}
                placeholder="Apartment/Unit # (Optional)"
                placeholderTextColor="#999"
                value={unit}
                onChangeText={setUnit}
                onFocus={() => setFocusedField('unit')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.rowContainer}>
              <View style={[
                styles.inputContainerHalf,
                focusedField === 'city' && styles.inputContainerFocused,
              ]}>
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={focusedField === 'city' ? theme.colors.primary : '#999'}
                />
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor="#999"
                  value={city}
                  onChangeText={setCity}
                  onFocus={() => setFocusedField('city')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[
                styles.inputContainerHalf,
                focusedField === 'state' && styles.inputContainerFocused,
              ]}>
                <Ionicons
                  name="flag-outline"
                  size={20}
                  color={focusedField === 'state' ? theme.colors.primary : '#999'}
                />
                <TextInput
                  style={styles.input}
                  placeholder="State/Province"
                  placeholderTextColor="#999"
                  value={state}
                  onChangeText={setState}
                  onFocus={() => setFocusedField('state')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.rowContainer}>
              <View style={[
                styles.inputContainerHalf,
                focusedField === 'zipCode' && styles.inputContainerFocused,
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={focusedField === 'zipCode' ? theme.colors.primary : '#999'}
                />
                <TextInput
                  style={styles.input}
                  placeholder="ZIP/Postal Code"
                  placeholderTextColor="#999"
                  value={zipCode}
                  onChangeText={setZipCode}
                  keyboardType="numeric"
                  onFocus={() => setFocusedField('zipCode')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[
                styles.inputContainerHalf,
                focusedField === 'country' && styles.inputContainerFocused,
              ]}>
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={focusedField === 'country' ? theme.colors.primary : '#999'}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Country"
                  placeholderTextColor="#999"
                  value={country}
                  onChangeText={setCountry}
                  onFocus={() => setFocusedField('country')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.actionButton, styles.backButton]}
                onPress={handleBack}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={20} color="#546DE5" style={styles.backIcon} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.nextButton]}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3a7bd5', '#546DE5', '#778BEB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradient}
                >
                  <Text style={styles.buttonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.arrowIcon} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>Housing Details</Text>

            <View style={styles.optionContainer}>
              <TouchableOpacity 
                style={[
                  styles.optionButton, 
                  !joinExistingHome && styles.optionButtonActive
                ]}
                onPress={() => setJoinExistingHome(false)}
              >
                <Text style={[
                  styles.optionText,
                  !joinExistingHome && styles.optionTextActive
                ]}>Create New Home</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.optionButton, 
                  joinExistingHome && styles.optionButtonActive
                ]}
                onPress={() => setJoinExistingHome(true)}
              >
                <Text style={[
                  styles.optionText,
                  joinExistingHome && styles.optionTextActive
                ]}>Join Existing Home</Text>
              </TouchableOpacity>
            </View>

            {joinExistingHome ? (
              <View style={[
                styles.inputContainer,
                focusedField === 'invitationCode' && styles.inputContainerFocused,
              ]}>
                <Ionicons 
                  name="key-outline" 
                  size={20} 
                  color={focusedField === 'invitationCode' ? theme.colors.primary : '#999'} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter Home Invitation Code"
                  placeholderTextColor="#999"
                  value={invitationCode}
                  onChangeText={text => setInvitationCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={6}
                  onFocus={() => setFocusedField('invitationCode')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            ) : (
              <>
                <View style={[
                  styles.inputContainer,
                  focusedField === 'rent' && styles.inputContainerFocused,
                ]}>
                  <Ionicons 
                    name="cash-outline" 
                    size={20} 
                    color={focusedField === 'rent' ? theme.colors.primary : '#999'} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Monthly Rent ($)"
                    placeholderTextColor="#999"
                    value={rent}
                    onChangeText={setRent}
                    keyboardType="numeric"
                    onFocus={() => setFocusedField('rent')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>

                <View style={[
                  styles.inputContainer,
                  focusedField === 'securityDeposit' && styles.inputContainerFocused,
                ]}>
                  <Ionicons 
                    name="shield-outline" 
                    size={20} 
                    color={focusedField === 'securityDeposit' ? theme.colors.primary : '#999'} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Security Deposit ($)"
                    placeholderTextColor="#999"
                    value={securityDeposit}
                    onChangeText={setSecurityDeposit}
                    keyboardType="numeric"
                    onFocus={() => setFocusedField('securityDeposit')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </>
            )}

            <DatePicker
              value={moveInDate}
              onChange={setMoveInDate}
              placeholder="Move-In Date (YYYY-MM-DD)"
              focused={focusedField === 'moveInDate'}
              onFocus={() => setFocusedField('moveInDate')}
              onBlur={() => setFocusedField(null)}
              error={moveInDate && !/^\d{4}-\d{2}-\d{2}$/.test(moveInDate) ? 'Please enter a valid date' : undefined}
            />

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.actionButton, styles.backButton]}
                onPress={handleBack}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={20} color="#546DE5" style={styles.backIcon} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.registerButton]}
                onPress={handleRegistration}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3a7bd5', '#546DE5', '#778BEB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      

      <LinearGradient
        colors={['rgba(84, 109, 229, 0.08)', 'rgba(119, 139, 235, 0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      />

      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <View style={styles.backButtonCircle}>
              <Ionicons name="arrow-back" size={20} color={theme.colors.primary} />
            </View>
            <Text style={[styles.backToLoginText, { color: theme.colors.primary }]}>Back to Login</Text>
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Create Account</Text>
            <Text style={styles.headerSubtitle}>Join SplitFair and manage shared expenses seamlessly</Text>
          </View>

          <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />

          <Animated.View
            style={[
              styles.formContainer,
              {
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ],
                opacity: opacityAnim,
              }
            ]}
          >
            {renderFormStep()}
          </Animated.View>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By registering, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>{' '}
              and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: height,
  },
  keyboardContainer: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(84, 109, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '500',
  },
  headerContainer: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  stepIndicatorContainer: {
    marginBottom: 28,
  },
  progressBackground: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    marginBottom: 18,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#546DE5',
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItemContainer: {
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeDot: {
    backgroundColor: '#546DE5',
  },
  stepNumber: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  activeStepNumber: {
    color: '#fff',
  },
  stepLabel: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  activeStepLabel: {
    color: '#546DE5',
    fontWeight: '600',
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 22,
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eeeeee',
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    marginBottom: 16,
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
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputContainerHalf: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eeeeee',
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    width: '48%',
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
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '400',
    color: '#333',
  },
  eyeIconButton: {
    padding: 5,
  },
  actionButton: {
    height: 60,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#546DE5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.05,
  },
  nextButton: {
    flex: 2,
  },
  backIcon: {
    marginRight: 8,
  },
  backButtonText: {
    color: '#546DE5',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    flex: 2,
    shadowColor: '#546DE5',
    shadowOpacity: 0.3,
  },
  termsContainer: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#546DE5',
    fontWeight: '500',
  },
  optionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  optionButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#546DE5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  optionTextActive: {
    color: '#546DE5',
    fontWeight: '600',
  },
});

export default RegisterScreen;