import {
  calculateDailyTotals,
  getTodayDateKey,
  groupMealsByDate,
  subscribeToMeals,
} from '@/components/chatService';
import { subscribeToProfile } from '@/components/userProfileService';
import { AppColors } from '@/constants/theme';
import type { UserProfile } from '@/types/userProfile';
import { calculateDailyTarget, isCalorieTargetBelowSafe } from '@/utils/calorieTarget';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const DEFAULT_CALORIE_GOAL = 2000;
const MACRO_GOALS = { carbs: 220, protein: 140, fat: 65 };

const RING_SIZE = 160;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CENTER = RING_SIZE / 2;

/** Track (unfilled) and progress (filled) colors — teal + warm amber, theme-aligned */
const RING_TRACK_COLOR = '#ca8a04';
const RING_PROGRESS_COLOR = AppColors.primary;
const RING_OVER_COLOR = AppColors.fat;

function CalorieRing({
  eaten,
  goal,
  remaining,
  progress,
}: {
  eaten: number;
  goal: number;
  remaining: number;
  progress: number;
}) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const circumference = 2 * Math.PI * RING_RADIUS;
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const isOver = progress > 1;
  const progressColor = isOver ? RING_OVER_COLOR : RING_PROGRESS_COLOR;

  return (
    <View style={ringStyles.wrapper}>
      <View style={[ringStyles.ringContainer, { width: RING_SIZE, height: RING_SIZE }]}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={ringStyles.svg}>
          <Circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            stroke={RING_TRACK_COLOR}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            stroke={progressColor}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          />
        </Svg>
        <View style={ringStyles.centerContent} pointerEvents="none">
          <Text style={ringStyles.remainingValue}>{remaining}</Text>
          <Text style={ringStyles.remainingLabel}>CALS REMAINING</Text>
        </View>
      </View>
      <View style={ringStyles.goalEatenBlock}>
        <Text style={ringStyles.goalEatenBold}>Goal {goal}</Text>
        <Text style={ringStyles.goalEatenDot}>·</Text>
        <Text style={ringStyles.goalEatenBold}>Eaten {eaten}</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', width: '100%' },
  ringContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  svg: { position: 'absolute' },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  remainingValue: { fontSize: 32, fontWeight: '700', color: AppColors.text },
  remainingLabel: { fontSize: 11, color: AppColors.textSecondary, marginTop: 2, letterSpacing: 0.5 },
  goalEatenBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  goalEatenBold: { fontSize: 16, fontWeight: '800', color: AppColors.text, letterSpacing: -0.2 },
  goalEatenDot: { fontSize: 16, fontWeight: '700', color: AppColors.textSecondary },
});

type MealItem = { id: string; foodItems?: string[]; estimatedCalories?: number; createdAt?: unknown };

export default function HomeScreen() {
  const router = useRouter();
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [burned, setBurned] = useState<number>(0);
  const [burnedInput, setBurnedInput] = useState<string>('0');

  useEffect(() => {
    const unsub = subscribeToMeals((list) => setMeals(list), () => setMeals([]));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToProfile(setProfile);
    return () => unsub();
  }, []);

  const { todayTotals, todayMeals } = useMemo(() => {
    const grouped = groupMealsByDate(meals);
    const todayKey = getTodayDateKey();
    const today = grouped.get(todayKey) ?? [];
    return { todayTotals: calculateDailyTotals(today), todayMeals: today };
  }, [meals]);

  const eaten = todayTotals.totalCalories;
  const calorieTarget = profile ? calculateDailyTarget(profile) : DEFAULT_CALORIE_GOAL;
  const remaining = calorieTarget - eaten + burned;
  const caloriePct = calorieTarget > 0 ? Math.min(100, (eaten / calorieTarget) * 100) : 0;
  const showSafetyWarning = profile != null && isCalorieTargetBelowSafe(calorieTarget, profile.gender);
  const carbsPct = Math.min(100, (todayTotals.totalCarbs / MACRO_GOALS.carbs) * 100);
  const proteinPct = Math.min(100, (todayTotals.totalProtein / MACRO_GOALS.protein) * 100);
  const fatPct = Math.min(100, (todayTotals.totalFat / MACRO_GOALS.fat) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {showSafetyWarning && (
        <View style={styles.safetyBanner}>
          <Text style={styles.safetyBannerText}>
            Your daily target is below the recommended minimum. Consider a smaller deficit in settings.
          </Text>
        </View>
      )}

      <View style={styles.calorieCard}>
        <CalorieRing
          eaten={eaten}
          goal={calorieTarget}
          remaining={remaining}
          progress={caloriePct / 100}
        />
      </View>

      <View style={styles.twoCards}>
        <View style={[styles.smallCard, styles.smallCardFirst]}>
          <Text style={styles.smallCardLabel}>Calories Eaten</Text>
          <Text style={styles.smallCardValue}>{eaten}</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.smallCardLabel}>Calories Burned</Text>
          <TextInput
            style={styles.burnedInput}
            value={burnedInput}
            onChangeText={setBurnedInput}
            onBlur={() => {
              const n = parseInt(burnedInput, 10);
              if (Number.isNaN(n) || n < 0) {
                setBurnedInput(String(burned));
              } else {
                const clamped = Math.max(0, Math.round(n));
                setBurned(clamped);
                setBurnedInput(String(clamped));
              }
            }}
            placeholder="0"
            placeholderTextColor={AppColors.textSecondary}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Macros</Text>
      <View style={styles.macroBars}>
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Carbs</Text>
          <View style={styles.macroTrack}>
            <View style={[styles.macroFill, { width: `${carbsPct}%`, backgroundColor: AppColors.carbs }]} />
          </View>
          <Text style={styles.macroValues}>{todayTotals.totalCarbs}g/{MACRO_GOALS.carbs}g</Text>
        </View>
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Protein</Text>
          <View style={styles.macroTrack}>
            <View style={[styles.macroFill, { width: `${proteinPct}%`, backgroundColor: AppColors.protein }]} />
          </View>
          <Text style={styles.macroValues}>{todayTotals.totalProtein}g/{MACRO_GOALS.protein}g</Text>
        </View>
        <View style={styles.macroRow}>
          <Text style={styles.macroLabel}>Fat</Text>
          <View style={styles.macroTrack}>
            <View style={[styles.macroFill, { width: `${fatPct}%`, backgroundColor: AppColors.fat }]} />
          </View>
          <Text style={styles.macroValues}>{todayTotals.totalFat}g/{MACRO_GOALS.fat}g</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today&apos;s Meals</Text>
      {todayMeals.length === 0 ? (
        <TouchableOpacity style={styles.mealRow} onPress={() => router.replace('/(tabs)/chat')} activeOpacity={0.7}>
          <Text style={styles.mealRowIcon}>🍽</Text>
          <Text style={styles.mealRowLabel}>No meals yet</Text>
          <Text style={styles.mealRowChevron}>›</Text>
        </TouchableOpacity>
      ) : (
        todayMeals.slice(0, 5).map((meal) => (
          <TouchableOpacity
            key={meal.id}
            style={styles.mealRow}
            onPress={() => router.replace('/(tabs)/meals')}
            activeOpacity={0.7}
          >
            <Text style={styles.mealRowIcon}>🍽</Text>
            <Text style={styles.mealRowLabel} numberOfLines={1}>
              {meal.foodItems?.length ? meal.foodItems.join(', ') : 'Meal'}
            </Text>
            <Text style={styles.mealRowCals}>{meal.estimatedCalories ?? 0} cals</Text>
            <Text style={styles.mealRowChevron}>›</Text>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity style={styles.logMealButton} onPress={() => router.replace('/(tabs)/chat')} activeOpacity={0.85}>
        <Text style={styles.logMealButtonText}>Log a meal</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  content: { padding: 20, paddingBottom: 32 },
  dateRow: { marginBottom: 20 },
  dateText: { fontSize: 15, color: AppColors.textSecondary },
  safetyBanner: {
    backgroundColor: AppColors.fat,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  safetyBannerText: { fontSize: 13, color: AppColors.text },
  calorieCard: {
    backgroundColor: AppColors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    alignItems: 'center',
  },
  twoCards: { flexDirection: 'row', marginBottom: 24 },
  smallCard: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    marginHorizontal: 6,
  },
  smallCardFirst: { marginLeft: 0 },
  smallCardLabel: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 4 },
  smallCardValue: { fontSize: 22, fontWeight: '700', color: AppColors.text },
  burnedInput: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
    padding: 0,
    minWidth: 48,
    textAlign: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: AppColors.text, marginBottom: 12 },
  macroBars: { marginBottom: 24 },
  macroRow: { marginBottom: 12 },
  macroLabel: { fontSize: 14, color: AppColors.text, marginBottom: 6 },
  macroTrack: { height: 10, backgroundColor: AppColors.cardBorder, borderRadius: 5, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 5 },
  macroValues: { fontSize: 12, color: AppColors.textSecondary, marginTop: 4 },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    marginBottom: 8,
  },
  mealRowIcon: { fontSize: 20, marginRight: 12 },
  mealRowLabel: { flex: 1, fontSize: 16, color: AppColors.text, fontWeight: '500' },
  mealRowCals: { fontSize: 14, color: AppColors.textSecondary, marginRight: 8 },
  mealRowChevron: { fontSize: 20, color: AppColors.textSecondary },
  logMealButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  logMealButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
