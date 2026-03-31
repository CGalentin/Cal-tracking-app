import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { logOut, reloadCurrentUser, resendVerificationEmail } from '@/components/authService';
import { getUserFriendlyMessage } from '@/utils/errorMessages';
import { AppColors } from '@/constants/theme';

const BACKGROUND_IMAGE = require('@/assets/images/landing-screen-background.jpg');

const POLL_MS = 30_000;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  const refreshAndLeaveIfVerified = useCallback(async () => {
    const result = await reloadCurrentUser();
    if (result.success && result.user?.emailVerified) {
      router.replace('login');
      return true;
    }
    return false;
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void refreshAndLeaveIfVerified();
      const id = setInterval(() => {
        void refreshAndLeaveIfVerified();
      }, POLL_MS);
      return () => clearInterval(id);
    }, [refreshAndLeaveIfVerified])
  );

  const handleContinue = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await reloadCurrentUser();
      if (!result.success) {
        Alert.alert('Error', getUserFriendlyMessage(result.error, 'auth'));
        return;
      }
      if (result.user?.emailVerified) {
        router.replace('login');
        return;
      }
      Alert.alert(
        'Not verified yet',
        'Open the link in the email we sent, then try again. Check your spam folder.'
      );
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      const result = await resendVerificationEmail();
      if (result.success) {
        Alert.alert(
          'Email sent',
          'Check your inbox for the verification link. It may take a minute to arrive.'
        );
      } else {
        Alert.alert('Error', getUserFriendlyMessage(result.error, 'auth'));
      }
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await logOut();
    router.replace('login');
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to your email address. Please click the link to verify your
          account and continue.
        </Text>
        <Text style={styles.hint}>Check your spam folder if you don't see it.</Text>

        <TouchableOpacity
          style={[styles.primaryButton, checking && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={checking}
          activeOpacity={0.85}>
          {checking ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>I've verified my email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, resending && styles.buttonDisabled, styles.secondaryAction]}
          onPress={handleResend}
          disabled={resending}
          activeOpacity={0.85}>
          {resending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Resend verification email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryAction: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
});
