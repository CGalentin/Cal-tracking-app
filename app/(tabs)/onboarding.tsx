import { ACTIVITY_LEVEL_LABELS } from '@/constants/activityLevels';
import type { ActivityLevelId } from '@/constants/activityLevels';
import { AppColors } from '@/constants/theme';
import type { Gender } from '@/types/userProfile';
import { setProfile } from '@/components/userProfileService';
import {
  calculateDailyTarget,
  isCalorieTargetBelowSafe,
  MIN_DAILY_CALORIES_FEMALE,
  MIN_DAILY_CALORIES_MALE,
} from '@/utils/calorieTarget';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

type Step = 1 | 2 | 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [activityLevelId, setActivityLevelId] = useState<ActivityLevelId>('sedentary');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [dailyCalorieDelta, setDailyCalorieDelta] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canProceedStep1 =
    weightKg.trim() !== '' &&
    heightCm.trim() !== '' &&
    age.trim() !== '' &&
    Number(weightKg) > 0 &&
    Number(heightCm) > 0 &&
    Number(age) > 0;

  const handleNext = () => {
    if (step === 1 && canProceedStep1) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const buildProfile = (): Parameters<typeof setProfile>[0] => {
    const w = Number(weightKg) || 70;
    const h = Number(heightCm) || 170;
    const a = Number(age) || 30;
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

  const handleFinish = () => {
    setErrorMessage(null);
    Keyboard.dismiss();
    const input = buildProfile();
    const profile = {
      weightKg: input.weightKg!,
      heightCm: input.heightCm!,
      age: input.age!,
      gender: input.gender!,
      activityLevelId: input.activityLevelId!,
      targetWeightKg: input.targetWeightKg,
      dailyCalorieDelta: input.dailyCalorieDelta ?? 0,
    };
    const dailyTarget = calculateDailyTarget(profile);
    const belowSafe = isCalorieTargetBelowSafe(dailyTarget, profile.gender);
    const minCal = profile.gender === 'female' ? MIN_DAILY_CALORIES_FEMALE : MIN_DAILY_CALORIES_MALE;

    if (belowSafe) {
      Alert.alert(
        'Low calorie target',
        `Your daily target would be ${dailyTarget} kcal, which is below the recommended minimum of ${minCal} kcal for ${profile.gender === 'female' ? 'women' : 'men'}. Consider a smaller deficit.`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Continue anyway', onPress: () => saveAndExit(input) },
        ]
      );
      return;
    }
    saveAndExit(input);
  };

  const saveAndExit = async (input: Parameters<typeof setProfile>[0]) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await setProfile(input);
      // Expo Go needs paths without leading slash to avoid Unmatched route
      const homePath = Platform.OS === 'web' ? '/(tabs)' : '(tabs)';
      router.replace(homePath);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : 'Could not save profile. Try again.';
      setErrorMessage(message);
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {step === 1 && 'Your metrics'}
          {step === 2 && 'Activity level'}
          {step === 3 && 'Your goal'}
        </Text>

        {step === 1 && (
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
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
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
        )}

        {step === 3 && (
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
        )}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
        <View style={styles.buttons}>
          {step > 1 ? (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          {step < 3 ? (
            <TouchableOpacity
              style={[styles.nextButton, (step === 1 && !canProceedStep1) && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={step === 1 && !canProceedStep1}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, saving && styles.nextButtonDisabled]}
              onPress={handleFinish}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>{saving ? 'Saving…' : 'Finish'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: AppColors.text, marginBottom: 24 },
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
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backButton: { padding: 16, minWidth: 100, alignItems: 'center' },
  backButtonText: { fontSize: 16, color: AppColors.textSecondary },
  nextButton: {
    flex: 1,
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: { opacity: 0.6 },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  errorBanner: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { fontSize: 14, color: '#fecaca' },
});
