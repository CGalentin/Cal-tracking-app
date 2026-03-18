import { ACTIVITY_LEVEL_LABELS } from '@/constants/activityLevels';
import type { ActivityLevelId } from '@/constants/activityLevels';
import { AppColors } from '@/constants/theme';
import type { Gender } from '@/types/userProfile';
import { setProfile, subscribeToProfile } from '@/components/userProfileService';
import {
  calculateDailyTarget,
  isCalorieTargetBelowSafe,
  MIN_DAILY_CALORIES_FEMALE,
  MIN_DAILY_CALORIES_MALE,
} from '@/utils/calorieTarget';
import type { UserProfile } from '@/types/userProfile';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DEFICIT_OPTIONS = [
  { label: 'Lose ~0.5 kg/week', value: -500 },
  { label: 'Lose ~0.25 kg/week', value: -250 },
  { label: 'Maintain weight', value: 0 },
  { label: 'Gain ~0.25 kg/week', value: 250 },
  { label: 'Gain ~0.5 kg/week', value: 500 },
];

export default function GoalsScreen() {
  const router = useRouter();
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [activityLevelId, setActivityLevelId] = useState<ActivityLevelId>('sedentary');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [dailyCalorieDelta, setDailyCalorieDelta] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const needsGoals = profile != null && profile.dailyCalorieDelta === undefined;

  useEffect(() => {
    const unsub = subscribeToProfile((p) => {
      setProfileState(p ?? null);
      if (p) {
        setWeightKg(String(p.weightKg));
        setHeightCm(String(p.heightCm));
        setAge(String(p.age));
        setGender(p.gender);
        setActivityLevelId(p.activityLevelId);
        setTargetWeightKg(p.targetWeightKg != null ? String(p.targetWeightKg) : '');
        setDailyCalorieDelta(p.dailyCalorieDelta ?? 0);
      }
    });
    return () => unsub();
  }, []);

  const buildInput = (): Parameters<typeof setProfile>[0] => {
    const w = Number(weightKg) || profile?.weightKg || 70;
    const h = Number(heightCm) || profile?.heightCm || 170;
    const a = Number(age) || profile?.age || 30;
    const target = targetWeightKg.trim() !== '' ? Number(targetWeightKg) : undefined;
    return {
      weightKg: w,
      heightCm: h,
      age: a,
      gender,
      activityLevelId,
      targetWeightKg: target,
      dailyCalorieDelta,
    };
  };

  const handleSave = () => {
    Keyboard.dismiss();
    const input = buildInput();
    const fullProfile = {
      weightKg: input.weightKg!,
      heightCm: input.heightCm!,
      age: input.age!,
      gender: input.gender!,
      activityLevelId: input.activityLevelId!,
      targetWeightKg: input.targetWeightKg,
      dailyCalorieDelta: input.dailyCalorieDelta ?? 0,
    };
    const dailyTarget = calculateDailyTarget(fullProfile);
    const belowSafe = isCalorieTargetBelowSafe(dailyTarget, fullProfile.gender);
    const minCal = fullProfile.gender === 'female' ? MIN_DAILY_CALORIES_FEMALE : MIN_DAILY_CALORIES_MALE;

    if (belowSafe) {
      Alert.alert(
        'Low calorie target',
        `Your daily target would be ${dailyTarget} kcal, which is below the recommended minimum of ${minCal} kcal for ${fullProfile.gender === 'female' ? 'women' : 'men'}. Consider a smaller deficit.`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Save anyway', onPress: () => doSave(input) },
        ]
      );
      return;
    }
    doSave(input);
  };

  const doSave = async (input: Parameters<typeof setProfile>[0]) => {
    setSaving(true);
    try {
      await setProfile(input);
      Alert.alert('Saved', 'Your goals have been updated.');
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : 'Could not save. Try again.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!profile) return;
    setSkipping(true);
    try {
      await setProfile({ dailyCalorieDelta: 0 });
      const homePath = Platform.OS === 'web' ? '/(tabs)' : '(tabs)';
      router.replace(homePath);
    } catch {
      setSkipping(false);
    }
  };

  if (profile === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {needsGoals && (
          <View style={styles.needsGoalsBanner}>
            <Text style={styles.needsGoalsText}>
              Set your daily calorie goal to personalize your dashboard.
            </Text>
            <TouchableOpacity
              style={[styles.skipButton, skipping && styles.skipButtonDisabled]}
              onPress={handleSkip}
              disabled={skipping}
            >
              <Text style={styles.skipButtonText}>{skipping ? 'Saving…' : 'Skip for now'}</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.title}>Goals & profile</Text>
        <Text style={styles.subtitle}>Update your metrics and daily calorie goal.</Text>

        <Text style={styles.sectionLabel}>Your metrics</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            placeholder="e.g. 70"
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            placeholder="e.g. 170"
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="e.g. 30"
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="number-pad"
          />
          <Text style={styles.label}>Gender</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.option, gender === 'female' && styles.optionSelected]}
              onPress={() => setGender('female')}
            >
              <Text style={[styles.optionText, gender === 'female' && styles.optionTextSelected]}>Female</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, gender === 'male' && styles.optionSelected]}
              onPress={() => setGender('male')}
            >
              <Text style={[styles.optionText, gender === 'male' && styles.optionTextSelected]}>Male</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Activity level</Text>
          {(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevelId[]).map((id) => (
            <TouchableOpacity
              key={id}
              style={[styles.optionBlock, activityLevelId === id && styles.optionBlockSelected]}
              onPress={() => setActivityLevelId(id)}
            >
              <Text style={[styles.optionBlockText, activityLevelId === id && styles.optionBlockTextSelected]}>
                {ACTIVITY_LEVEL_LABELS[id]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Your goal</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Target weight (kg, optional)</Text>
          <TextInput
            style={styles.input}
            value={targetWeightKg}
            onChangeText={setTargetWeightKg}
            placeholder="e.g. 65"
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Daily calorie change</Text>
          {DEFICIT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBlock, dailyCalorieDelta === opt.value && styles.optionBlockSelected]}
              onPress={() => setDailyCalorieDelta(opt.value)}
            >
              <Text style={[styles.optionBlockText, dailyCalorieDelta === opt.value && styles.optionBlockTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  placeholder: { color: AppColors.textSecondary, textAlign: 'center', marginTop: 24 },
  title: { fontSize: 22, fontWeight: '700', color: AppColors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: AppColors.textSecondary, marginBottom: 24 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: AppColors.text, marginBottom: 12 },
  form: { marginBottom: 24 },
  label: { fontSize: 14, color: AppColors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  option: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    alignItems: 'center',
  },
  optionSelected: { borderColor: AppColors.primary, backgroundColor: AppColors.card },
  optionText: { fontSize: 16, color: AppColors.textSecondary },
  optionTextSelected: { color: AppColors.primary, fontWeight: '600' },
  optionBlock: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    marginBottom: 10,
  },
  optionBlockSelected: { borderColor: AppColors.primary, backgroundColor: AppColors.card },
  optionBlockText: { fontSize: 15, color: AppColors.text },
  optionBlockTextSelected: { color: AppColors.primary, fontWeight: '600' },
  saveButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  needsGoalsBanner: {
    backgroundColor: AppColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  needsGoalsText: { fontSize: 14, color: AppColors.text, marginBottom: 12 },
  skipButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonDisabled: { opacity: 0.6 },
  skipButtonText: { fontSize: 15, color: AppColors.primary, fontWeight: '600' },
});
