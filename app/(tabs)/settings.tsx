import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

import { logOut, updateDisplayName } from '@/components/authService';
import { clearFeatureTourFlag } from '@/components/featureTourStorage';
import { auth } from '@/components/firebaseConfig';
import { AppColors } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resettingTour, setResettingTour] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [updatingDisplayName, setUpdatingDisplayName] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return unsub;
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logOut();
    } finally {
      setLoggingOut(false);
    }
  }, []);

  const handleResetTour = useCallback(async () => {
    setResettingTour(true);
    try {
      await clearFeatureTourFlag();
      Alert.alert(
        'Feature tour reset',
        'The welcome tour will show again the next time you open the app (after you leave this screen).',
        [{ text: 'OK' }]
      );
    } finally {
      setResettingTour(false);
    }
  }, []);

  const handleShowTourNow = useCallback(async () => {
    await clearFeatureTourFlag();
    router.replace(Platform.OS !== 'web' ? 'feature-tour' : '/feature-tour');
  }, [router]);

  const startEditingDisplayName = useCallback(() => {
    setDisplayNameDraft(user?.displayName?.trim() ?? '');
    setEditingDisplayName(true);
  }, [user?.displayName]);

  const cancelEditingDisplayName = useCallback(() => {
    setEditingDisplayName(false);
    setDisplayNameDraft('');
  }, []);

  const saveDisplayName = useCallback(async () => {
    setUpdatingDisplayName(true);
    try {
      const result = await updateDisplayName(displayNameDraft);
      if (result.success) {
        setEditingDisplayName(false);
        setDisplayNameDraft('');
      } else {
        Alert.alert('Could not update', result.error?.message ?? 'Please try again.');
      }
    } finally {
      setUpdatingDisplayName(false);
    }
  }, [displayNameDraft]);

  const email = user?.email ?? '—';
  const displayName = user?.displayName?.trim() || 'Not set';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value} selectable>
            {email}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Display name</Text>
          {editingDisplayName ? (
            <View style={styles.displayNameEdit}>
              <TextInput
                style={styles.displayNameInput}
                value={displayNameDraft}
                onChangeText={setDisplayNameDraft}
                placeholder="Enter display name"
                placeholderTextColor={AppColors.textSecondary}
                autoFocus
                editable={!updatingDisplayName}
              />
              <View style={styles.displayNameActions}>
                <Pressable
                  onPress={cancelEditingDisplayName}
                  disabled={updatingDisplayName}
                  style={({ pressed }) => [styles.displayNameButton, pressed && styles.pressed]}>
                  <Text style={styles.displayNameButtonTextSecondary}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveDisplayName}
                  disabled={updatingDisplayName}
                  style={({ pressed }) => [styles.displayNameButton, pressed && styles.pressed]}>
                  {updatingDisplayName ? (
                    <ActivityIndicator size="small" color={AppColors.primary} />
                  ) : (
                    <Text style={styles.displayNameButtonText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={startEditingDisplayName}
              style={({ pressed }) => [styles.displayNameRow, pressed && styles.pressed]}>
              <Text style={styles.value}>{displayName}</Text>
              <Text style={styles.changeHint}>Change</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Help & onboarding</Text>
      <View style={styles.card}>
        <Pressable
          style={({ pressed }) => [styles.buttonRow, pressed && styles.pressed]}
          onPress={handleResetTour}
          disabled={resettingTour}>
          {resettingTour ? (
            <ActivityIndicator color={AppColors.primary} />
          ) : (
            <Text style={styles.buttonRowText}>Reset welcome tour (next launch)</Text>
          )}
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={({ pressed }) => [styles.buttonRow, pressed && styles.pressed]}
          onPress={handleShowTourNow}>
          <Text style={styles.buttonRowText}>Show welcome tour now</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.logoutButton, loggingOut && styles.logoutDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}>
        {loggingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.logoutText}>Log out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: AppColors.text,
    fontWeight: '500',
  },
  displayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeHint: {
    fontSize: 15,
    color: AppColors.primary,
    fontWeight: '600',
  },
  displayNameEdit: {
    marginTop: 8,
  },
  displayNameInput: {
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    backgroundColor: AppColors.background,
  },
  displayNameActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
    justifyContent: 'flex-end',
  },
  displayNameButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  displayNameButtonText: {
    fontSize: 16,
    color: AppColors.primary,
    fontWeight: '600',
  },
  displayNameButtonTextSecondary: {
    fontSize: 16,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.cardBorder,
    marginLeft: 16,
  },
  buttonRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  buttonRowText: {
    fontSize: 16,
    color: AppColors.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  logoutButton: {
    marginTop: 32,
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
