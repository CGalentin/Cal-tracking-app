import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getHasSeenFeatureTour } from '@/components/featureTourStorage';
import { getProfile, profileNeedsGoals, subscribeToProfile } from '@/components/userProfileService';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import type { UserProfile } from '@/types/userProfile';
import { AppColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { auth } from '@/components/firebaseConfig';
import { subscribeToAuthChanges } from '../components/authService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  /** null = not read yet; true = must verify (set only after sign-up); false = sign-in or cleared */
  const [enforceEmailVerify, setEnforceEmailVerify] = useState<boolean | null>(null);

  // Subscribe to Firebase auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser: unknown) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setEnforceEmailVerify(false);
      return undefined;
    }
    setEnforceEmailVerify(null);
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEYS.ENFORCE_EMAIL_VERIFY_AFTER_SIGNUP).then((v) => {
      if (!cancelled) setEnforceEmailVerify(v === '1');
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // When user is set, resolve profile (initial fetch for login redirect, then subscribe so we see updates)
  useEffect(() => {
    if (!user) {
      setProfile(undefined);
      return;
    }
    let cancelled = false;
    getProfile()
      .then((p) => {
        if (!cancelled) setProfile(p ?? null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    const unsub = subscribeToProfile((p) => {
      if (!cancelled) setProfile(p ?? null);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  // Redirect based on auth state and profile (from login → verify-email → onboarding / goals / feature tour / home)
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';
    const inVerifyEmail = segments[0] === 'verify-email';
    const isLoggedIn = !!user;
    // Use live Firebase user so we don't stay stuck after reload() before React auth state updates
    const liveUser = auth.currentUser ?? (user as { emailVerified?: boolean } | null);
    const emailVerified = liveUser?.emailVerified === true;
    const needsVerification =
      isLoggedIn &&
      enforceEmailVerify === true &&
      !!liveUser &&
      !emailVerified;

    if (isLoggedIn && enforceEmailVerify === null) return undefined;

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('login');
      return undefined;
    }

    if (!isLoggedIn) return undefined;

    // Send unverified users to verify-email from any route (e.g. login or stale tabs)
    if (needsVerification && !inVerifyEmail) {
      router.replace('verify-email');
      return undefined;
    }

    // Do not run onboarding / tabs / tour while email is still unverified
    if (needsVerification) return undefined;

    if (!inAuthGroup && !inVerifyEmail) return undefined;

    if (profile === undefined) return undefined;

    const isNative = Platform.OS !== 'web';
    const homePath = isNative ? '(tabs)' : '/(tabs)';
    const onboardingPath = isNative ? '(tabs)/onboarding' : '/(tabs)/onboarding';
    const goalsPath = isNative ? '(tabs)/goals' : '/(tabs)/goals';
    const featureTourPath = isNative ? 'feature-tour' : '/feature-tour';

    let cancelled = false;
    void (async () => {
      if (!profile) {
        if (!cancelled) router.replace(onboardingPath);
        return;
      }
      if (profileNeedsGoals(profile)) {
        if (!cancelled) router.replace(goalsPath);
        return;
      }
      const seen = await getHasSeenFeatureTour();
      if (cancelled) return;
      if (seen) router.replace(homePath);
      else router.replace(featureTourPath);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, profile, segments, router, enforceEmailVerify]);

  // Returning users on tabs: show feature tour once if they have not seen it (PR 19)
  useEffect(() => {
    const liveUser = auth.currentUser ?? (user as { emailVerified?: boolean } | null);
    if (liveUser && enforceEmailVerify === true && liveUser.emailVerified !== true) return undefined;

    if (loading || !user || profile === undefined || profile === null || profileNeedsGoals(profile)) {
      return undefined;
    }
    if (!segments.length) return undefined;
    const seg0 = segments[0];
    if (seg0 === 'login' || seg0 === 'feature-tour') return undefined;

    // Only open the feature tour from the Home tab — otherwise opening Goals/Meals/etc. on web gets
    // replaced immediately and looks like the screen "won't load".
    if (seg0 !== '(tabs)') return undefined;
    const tabRoute = segments[1];
    const isHomeTab = tabRoute === undefined || tabRoute === 'index';
    if (!isHomeTab) return undefined;

    let cancelled = false;
    void getHasSeenFeatureTour().then((seen) => {
      if (cancelled || seen) return;
      const featureTourPath = Platform.OS !== 'web' ? 'feature-tour' : '/feature-tour';
      router.replace(featureTourPath);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, user, profile, segments, router, enforceEmailVerify]);

  // While checking auth, show a simple loading screen
  if (loading) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            backgroundColor: AppColors.background,
          }}>
          <Text style={{ color: AppColors.text }}>Loading...</Text>
          <StatusBar style="light" />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="verify-email" options={{ headerShown: false }} />
          <Stack.Screen name="feature-tour" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
