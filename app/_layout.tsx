import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import 'react-native-reanimated';

import { getProfile, profileNeedsGoals, subscribeToProfile } from '@/components/userProfileService';
import type { UserProfile } from '@/types/userProfile';
import { AppColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscribeToAuthChanges } from '../components/authService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  // Subscribe to Firebase auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser: unknown) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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

  // Redirect based on auth state and profile
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';
    const isLoggedIn = !!user;

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('login');
    } else if (isLoggedIn && inAuthGroup) {
      if (profile === undefined) return;
      // Expo Go on native often needs paths without leading slash to avoid "Unmatched route"
      const isNative = Platform.OS !== 'web';
      const homePath = isNative ? '(tabs)' : '/(tabs)';
      const onboardingPath = isNative ? '(tabs)/onboarding' : '/(tabs)/onboarding';
      const goalsPath = isNative ? '(tabs)/goals' : '/(tabs)/goals';
      if (!profile) {
        router.replace(onboardingPath);
      } else if (profileNeedsGoals(profile)) {
        router.replace(goalsPath);
      } else {
        router.replace(homePath);
      }
    }
  }, [user, loading, profile, segments, router]);

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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
