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
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { logDebug, logError } from '../../utils/DebugHelper';

const { width, height } = Dimensions.get('window');

// Types
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

// Premium Logo Component
const LogoText = () => {
  const firstLetterScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Pulse animation for first letters
    const pulse = Animated.sequence([
      Animated.timing(firstLetterScale, {
        toValue: 1.1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(firstLetterScale, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]);

    // Glow effect animation
    const glow = Animated.sequence([
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }),
      Animated.timing(glowAnim, {
        toValue: 0.7,
        duration: 1500,
        useNativeDriver: false,
      }),
    ]);

    // Floating animation
    const float = Animated.sequence([
      Animated.timing(translateY, {
        toValue: -6,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]);

    // Run animations in loop
    Animated.parallel([
      Animated.loop(pulse), 
      Animated.loop(glow),
      Animated.loop(float)
    ]).start();
  }, []);

  // Calculate shadow opacity based on glow animation
  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.logoContainer}>
      <Animated.View 
        style={[
          styles.logoWrapper,
          { 
            transform: [{ translateY }],
            shadowOpacity,
          }
        ]}
      >
        <LinearGradient
          colors={['#3a7bd5', '#546DE5', '#778BEB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoGradient}
        >
          <View style={styles.logoTextContainer}>
            <Animated.Text 
              style={[
                styles.logoTextFirst, 
                { transform: [{ scale: firstLetterScale }] }
              ]}
            >
              S
            </Animated.Text>
            <Text style={styles.logoText}>plit</Text>
            <Animated.Text 
              style={[
                styles.logoTextFirst,
                { transform: [{ scale: firstLetterScale }] }
              ]}
            >
              F
            </Animated.Text>
            <Text style={styles.logoText}>air</Text>
          </View>

          {/* Decorative element */}
          <View style={styles.logoDecorElement}></View>
        </LinearGradient>
      </Animated.View>
      <Text style={styles.tagline}>Share expenses, not stress</Text>
    </View>
  );
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
  // Debug reload issues
  const isInitialMount = useRef(true);
  const animationsStarted = useRef(false);
  
  useEffect(() => {
    logDebug('LoginScreen mounted - first screen after reload');
    
    if (isInitialMount.current) {
      logDebug('Initial mount - starting entrance animations');
      isInitialMount.current = false;
    }
    
    // Only start animations if they haven't been started already
    if (!animationsStarted.current) {
      const startAnimation = () => {
        logDebug('Starting login screen animations');
        
        // Reset animation values to initial state
        slideAnim.setValue(50);
        opacityAnim.setValue(0);
        scaleAnim.setValue(0.95);
        
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          })
        ]).start(() => {
          logDebug('Login screen animations completed');
          animationsStarted.current = true;
        });
      };
      
      // Run animations on next frame to avoid React Native animation issues
      const animationTimer = setTimeout(() => {
        startAnimation();
      }, 100);
      
      return () => {
        logDebug('LoginScreen unmounting');
        clearTimeout(animationTimer);
      };
    }
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    logDebug(`Attempting login for user: ${email}`);
    setLoading(true);
    
    try {
      // Add a short delay to ensure any previous auth operations complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await signIn(email, password);
      logDebug('Login successful');
    } catch (error: any) {
      logError(`Login failed: ${error.message}`);
      
      // Enhanced error message
      let errorMsg = error.message;
      if (error.message.includes("Invalid login credentials")) {
        errorMsg = "Invalid email or password. If you just registered, please wait a few moments and try again.";
      }
      
      Alert.alert('Login Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Background gradient */}
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
        <LogoText />
        
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
          <View style={styles.form}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.welcomeSubtext}>Sign in to continue</Text>
            
            <View style={[
              styles.inputContainer,
              emailFocused && styles.inputContainerFocused,
            ]}>
              <Ionicons 
                name="mail-outline" 
                size={20} 
                color={emailFocused ? theme.colors.primary : '#999'} 
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.colors.text }
                ]}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View style={[
              styles.inputContainer,
              passwordFocused && styles.inputContainerFocused,
            ]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={20} 
                color={passwordFocused ? theme.colors.primary : '#999'} 
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.colors.text }
                ]}
                placeholder="Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
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

            <TouchableOpacity 
              style={styles.forgotPasswordLink}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
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
                  <>
                    <Text style={styles.loginButtonText}>Sign In</Text>
                    <Ionicons name="arrow-forward-outline" size={18} color="white" style={styles.arrowIcon} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.orContainer}>
              <View style={styles.divider} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialButtonsContainer}>
              <TouchableOpacity 
                style={[styles.socialButton, styles.googleButton]}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-google" size={20} color="#EB4132" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.socialButton, styles.appleButton]}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-apple" size={20} color="#000" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account?</Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoWrapper: {
    borderRadius: 20,
    shadowColor: '#546DE5',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowRadius: 15,
    elevation: 10,
  },
  logoGradient: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTextFirst: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.8,
  },
  logoDecorElement: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tagline: {
    marginTop: 14,
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
  },
  form: {
    width: '100%',
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
    shadowRadius: 3,
    elevation: 1,
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
  },
  eyeIconButton: {
    padding: 5, // Increasing touchable area
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 28,
  },
  forgotPasswordText: {
    color: '#546DE5',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    height: 60,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#546DE5',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  orText: {
    color: '#999',
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 20,
    width: '48%',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  appleButton: {
    backgroundColor: '#fff',
  },
  socialButtonText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  registerText: {
    color: '#666',
    marginRight: 5,
    fontSize: 15,
  },
  registerLink: {
    color: '#546DE5',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default LoginScreen;
