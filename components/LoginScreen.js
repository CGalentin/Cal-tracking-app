// LoginScreen.js
import { AppColors } from '@/constants/theme';
import React, { useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { signIn, signUp } from './authService';

const BACKGROUND_IMAGE = require('@/assets/images/landing-screen-background.jpg');

export default function LoginScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [screen, setScreen] = useState('welcome'); // 'welcome' | 'login' | 'signup'

  const handleAuth = async () => {
    if (isSignUp && !displayName) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const result = isSignUp
      ? await signUp(email, password, displayName)
      : await signIn(email, password);

    if (result.success) {
      Alert.alert('Success', isSignUp ? 'Account created!' : 'Logged in!');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const showLogin = () => {
    setIsSignUp(false);
    setScreen('login');
  };

  const showSignUp = () => {
    setIsSignUp(true);
    setScreen('signup');
  };

  const backToWelcome = () => {
    setScreen('welcome');
    setDisplayName('');
    setEmail('');
    setPassword('');
  };

  const isForm = screen === 'login' || screen === 'signup';

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isForm && styles.scrollContentForm]}
          keyboardShouldPersistTaps="handled"
        >
          {screen === 'welcome' && (
            <>
              <Text style={styles.welcomeTitle}>Welcome to the CalApp</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.primaryButton} onPress={showLogin} activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={showSignUp} activeOpacity={0.85}>
                  <Text style={styles.secondaryButtonText}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {(screen === 'login' || screen === 'signup') && (
            <>
              <Text style={styles.formTitle}>{isSignUp ? 'Create Account' : 'Log in'}</Text>
              <Text style={styles.formSubtitle}>
                {isSignUp ? 'Sign up to start tracking your meals.' : 'Log in to continue.'}
              </Text>

              {isSignUp && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Display Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your name"
                    placeholderTextColor={AppColors.textSecondary}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={AppColors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={AppColors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>{isSignUp ? 'Sign up' : 'Login'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backButton} onPress={backToWelcome}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  scrollContentForm: {
    justifyContent: 'flex-start',
    paddingTop: 48,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 40,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  buttonRow: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    color: '#ffffff',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#ffffff',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
});