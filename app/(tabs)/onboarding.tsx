import { ACTIVITY_LEVEL_LABELS } from '@/constants/activityLevels';
import type { ActivityLevelId } from '@/constants/activityLevels';
import { AppColors } from '@/constants/theme';
import type { Gender, UnitSystem } from '@/types/userProfile';
import { setProfile } from '@/components/userProfileService';
import {
  calculateDailyTarget,
  isCalorieTargetBelowSafe,
  MIN_DAILY_CALORIES_FEMALE,
  MIN_DAILY_CALORIES_MALE,
} from '@/utils/calorieTarget';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '@/utils/unitConversions';
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

type Step = 1 | 2 | 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
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
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const heightValid =
    useUnits === 'metric'
      ? heightCmInput.trim() !== '' && Number(heightCmInput) > 0
      : (heightFtInput.trim() !== '' || heightInInput.trim() !== '') &&
        Number(heightFtInput) >= 0 &&
        Number(heightInInput) >= 0 &&
        (Number(heightFtInput) > 0 || Number(heightInInput) > 0);
  const canProceedStep1 =
    weightInput.trim() !== '' &&
    heightValid &&
    age.trim() !== '' &&
    Number(weightInput) > 0 &&
    Number(age) > 0;

  const DEFICIT_OPTIONS = useUnits === 'metric' ? DEFICIT_OPTIONS_METRIC : DEFICIT_OPTIONS_STANDARD;

  const handleUnitsChange = (units: UnitSystem) => {
    if (units === useUnits) return;
    const weightKg =
      useUnits === 'metric' ? Number(weightInput) || 70 : lbToKg(Number(weightInput) || 154);
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

  const handleNext = () => {
    if (step === 1 && canProceedStep1) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const buildProfile = (): Parameters<typeof setProfile>[0] => {
    const a = Number(age) || 30;
    let w: number;
    let h: number;
    let target: number | undefined;
    if (useUnits === 'metric') {
      w = Number(weightInput) || 70;
      h = Number(heightCmInput) || 170;
      target = targetWeightInput.trim() !== '' ? Number(targetWeightInput) : undefined;
    } else {
      w = lbToKg(Number(weightInput) || 154);
      h = ftInToCm(Number(heightFtInput) || 5, Number(heightInInput) || 10);
      target = targetWeightInput.trim() !== '' ? lbToKg(Number(targetWeightInput)) : undefined;
    }
    return {
      weightKg: w,
      heightCm: h,
      age: a,
      gender,
      activityLevelId,
      targetWeightKg: target,
      dailyCalorieDelta,
      useUnits,
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
            <Text style={styles.label}>Units</Text>
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
