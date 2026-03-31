import { ACTIVITY_LEVEL_LABELS } from '@/constants/activityLevels';
import type { ActivityLevelId } from '@/constants/activityLevels';
import { AppColors } from '@/constants/theme';
import type { Gender, UnitSystem } from '@/types/userProfile';
import { setProfile, subscribeToProfile } from '@/components/userProfileService';
import {
  calculateDailyTarget,
  isCalorieTargetBelowSafe,
  MIN_DAILY_CALORIES_FEMALE,
  MIN_DAILY_CALORIES_MALE,
} from '@/utils/calorieTarget';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '@/utils/unitConversions';
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

const DEFICIT_OPTIONS_METRIC = [
  { label: 'Lose ~0.5 kg/week', value: -500 },
  { label: 'Lose ~0.25 kg/week', value: -250 },
  { label: 'Maintain weight', value: 0 },
  { label: 'Gain ~0.25 kg/week', value: 250 },
  { label: 'Gain ~0.5 kg/week', value: 500 },
];

const DEFICIT_OPTIONS_STANDARD = [
  { label: 'Lose ~1 lb/week', value: -500 },
  { label: 'Lose ~0.5 lb/week', value: -250 },
  { label: 'Maintain weight', value: 0 },
  { label: 'Gain ~0.5 lb/week', value: 250 },
  { label: 'Gain ~1 lb/week', value: 500 },
];

export default function GoalsScreen() {
  const router = useRouter();
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  /** False until Firestore (via auth-aware subscribe) has delivered at least one snapshot. */
  const [profileReady, setProfileReady] = useState(false);
  const [useUnits, setUseUnits] = useState<UnitSystem>('standard');
  const [weightInput, setWeightInput] = useState('');
  const [heightCmInput, setHeightCmInput] = useState('');
  const [heightFtInput, setHeightFtInput] = useState('');
  const [heightInInput, setHeightInInput] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [activityLevelId, setActivityLevelId] = useState<ActivityLevelId>('sedentary');
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [dailyCalorieDelta, setDailyCalorieDelta] = useState(0);
  const [customDeltaInput, setCustomDeltaInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const needsGoals = profile != null && profile.dailyCalorieDelta === undefined;
  const DEFICIT_OPTIONS = useUnits === 'metric' ? DEFICIT_OPTIONS_METRIC : DEFICIT_OPTIONS_STANDARD;

  useEffect(() => {
    const unsub = subscribeToProfile((p) => {
      setProfileReady(true);
      setProfileState(p ?? null);
      if (p) {
        const units = p.useUnits ?? 'standard';
        setUseUnits(units);
        if (units === 'metric') {
          setWeightInput(String(p.weightKg));
          setHeightCmInput(String(p.heightCm));
          setTargetWeightInput(p.targetWeightKg != null ? String(p.targetWeightKg) : '');
        } else {
          setWeightInput(String(Math.round(kgToLb(p.weightKg) * 10) / 10));
          const [ft, inVal] = cmToFtIn(p.heightCm);
          setHeightFtInput(String(ft));
          setHeightInInput(String(Math.round(inVal * 10) / 10));
          setTargetWeightInput(
            p.targetWeightKg != null ? String(Math.round(kgToLb(p.targetWeightKg) * 10) / 10) : ''
          );
        }
        setAge(String(p.age));
        setGender(p.gender);
        setActivityLevelId(p.activityLevelId);
        const delta = p.dailyCalorieDelta ?? 0;
        setDailyCalorieDelta(delta);
        const opts = units === 'metric' ? DEFICIT_OPTIONS_METRIC : DEFICIT_OPTIONS_STANDARD;
        const isPreset = opts.some((o) => o.value === delta);
        setCustomDeltaInput(isPreset ? '' : String(delta));
      }
    });
    return () => unsub();
  }, []);

  const handleUnitsChange = (units: UnitSystem) => {
    if (units === useUnits) return;
    const weightKg =
      useUnits === 'metric' ? Number(weightInput) || 70 : lbToKg(Number(weightInput) || 70);
    const heightCm =
      useUnits === 'metric'
        ? Number(heightCmInput) || 170
        : ftInToCm(Number(heightFtInput) || 5, Number(heightInInput) || 10);
    const targetKg =
      targetWeightInput.trim() !== ''
        ? useUnits === 'metric'
          ? Number(targetWeightInput)
          : lbToKg(Number(targetWeightInput))
        : null;
    setUseUnits(units);
    if (units === 'metric') {
      setWeightInput(String(Math.round(weightKg * 10) / 10));
      setHeightCmInput(String(Math.round(heightCm)));
      setTargetWeightInput(targetKg != null ? String(Math.round(targetKg * 10) / 10) : '');
    } else {
      setWeightInput(String(Math.round(kgToLb(weightKg) * 10) / 10));
      const [ft, inVal] = cmToFtIn(heightCm);
      setHeightFtInput(String(ft));
      setHeightInInput(String(Math.round(inVal * 10) / 10));
      setTargetWeightInput(targetKg != null ? String(Math.round(kgToLb(targetKg) * 10) / 10) : '');
    }
  };

  const buildInput = (): Parameters<typeof setProfile>[0] => {
    const a = Number(age) || profile?.age || 30;
    const customNum = customDeltaInput.trim() !== '' ? Number(customDeltaInput) : NaN;
    const delta = !Number.isNaN(customNum) ? Math.round(customNum) : dailyCalorieDelta;

    let w: number;
    let h: number;
    let target: number | undefined;
    if (useUnits === 'metric') {
      w = Number(weightInput) || profile?.weightKg || 70;
      h = Number(heightCmInput) || profile?.heightCm || 170;
      target = targetWeightInput.trim() !== '' ? Number(targetWeightInput) : undefined;
    } else {
      const wLb = Number(weightInput) || (profile ? kgToLb(profile.weightKg) : 154);
      const [defFt, defIn] = profile ? cmToFtIn(profile.heightCm) : [5, 10];
      const hFt = Number(heightFtInput) || defFt;
      const hIn = Number(heightInInput) || defIn;
      w = lbToKg(wLb);
      h = ftInToCm(hFt, hIn);
      target = targetWeightInput.trim() !== '' ? lbToKg(Number(targetWeightInput)) : undefined;
    }

    return {
      weightKg: w,
      heightCm: h,
      age: a,
      gender,
      activityLevelId,
      targetWeightKg: target,
      dailyCalorieDelta: delta,
      useUnits,
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

  if (!profileReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Loading…</Text>
      </View>
    );
  }

  if (profile === null) {
    const onboardingPath = Platform.OS === 'web' ? '/(tabs)/onboarding' : '(tabs)/onboarding';
    return (
      <View style={[styles.container, styles.missingProfileWrap]}>
        <Text style={styles.missingProfileTitle}>Profile not found</Text>
        <Text style={styles.missingProfileText}>
          We couldn&apos;t load your saved metrics. Complete setup or check your connection.
        </Text>
        <TouchableOpacity style={styles.saveButton} onPress={() => router.replace(onboardingPath)} activeOpacity={0.85}>
          <Text style={styles.saveButtonText}>Open setup</Text>
        </TouchableOpacity>
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

        <Text style={styles.sectionLabel}>Units</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.option, useUnits === 'standard' && styles.optionSelected]}
            onPress={() => handleUnitsChange('standard')}
          >
            <Text style={[styles.optionText, useUnits === 'standard' && styles.optionTextSelected]}>
              Standard (lbs, ft/in)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, useUnits === 'metric' && styles.optionSelected]}
            onPress={() => handleUnitsChange('metric')}
          >
            <Text style={[styles.optionText, useUnits === 'metric' && styles.optionTextSelected]}>
              Metric (kg, cm)
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Your metrics</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Weight ({useUnits === 'metric' ? 'kg' : 'lbs'})</Text>
          <TextInput
            style={styles.input}
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder={useUnits === 'metric' ? 'e.g. 70' : 'e.g. 154'}
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Height ({useUnits === 'metric' ? 'cm' : 'ft and in'})</Text>
          {useUnits === 'metric' ? (
            <TextInput
              style={styles.input}
              value={heightCmInput}
              onChangeText={setHeightCmInput}
              placeholder="e.g. 170"
              placeholderTextColor={AppColors.textSecondary}
              keyboardType="decimal-pad"
            />
          ) : (
            <View style={styles.heightRow}>
              <TextInput
                style={[styles.input, styles.heightInput]}
                value={heightFtInput}
                onChangeText={setHeightFtInput}
                placeholder="ft"
                placeholderTextColor={AppColors.textSecondary}
                keyboardType="number-pad"
              />
              <Text style={styles.heightSeparator}>ft</Text>
              <TextInput
                style={[styles.input, styles.heightInput]}
                value={heightInInput}
                onChangeText={setHeightInInput}
                placeholder="in"
                placeholderTextColor={AppColors.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.heightSeparator}>in</Text>
            </View>
          )}
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
          <Text style={styles.label}>Target weight ({useUnits === 'metric' ? 'kg' : 'lbs'}, optional)</Text>
          <TextInput
            style={styles.input}
            value={targetWeightInput}
            onChangeText={setTargetWeightInput}
            placeholder={useUnits === 'metric' ? 'e.g. 65' : 'e.g. 143'}
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Daily calorie change</Text>
          {DEFICIT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionBlock,
                (customDeltaInput === '' ? dailyCalorieDelta : Number(customDeltaInput)) === opt.value &&
                  styles.optionBlockSelected,
              ]}
              onPress={() => {
                setDailyCalorieDelta(opt.value);
                setCustomDeltaInput('');
              }}
            >
              <Text
                style={[
                  styles.optionBlockText,
                  (customDeltaInput === '' ? dailyCalorieDelta : Number(customDeltaInput)) === opt.value &&
                    styles.optionBlockTextSelected,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={[styles.label, { marginTop: 16 }]}>Or enter manually (kcal)</Text>
          <TextInput
            style={styles.input}
            value={customDeltaInput}
            onChangeText={(text) => {
              setCustomDeltaInput(text);
              const n = Number(text);
              if (text.trim() !== '' && !Number.isNaN(n)) setDailyCalorieDelta(Math.round(n));
            }}
            placeholder="-500 to lose, +500 to gain"
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="default"
          />
          <Text style={styles.hint}>
            Negative = deficit (lose weight). Positive = surplus (gain weight). ~500 kcal/day ≈{' '}
            {useUnits === 'metric' ? '0.5 kg' : '1 lb'}/week.
          </Text>
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
  missingProfileWrap: { padding: 24, justifyContent: 'center', flex: 1 },
  missingProfileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  missingProfileText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
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
  hint: {
    fontSize: 13,
    color: AppColors.textSecondary,
    marginTop: -8,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  heightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  heightInput: { flex: 1, marginBottom: 0 },
  heightSeparator: { fontSize: 14, color: AppColors.textSecondary },
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
