import { Link } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { calculateDailyTotals, formatDateKeyForDisplay, getTodayDateKey, groupMealsByDate, subscribeToMeals } from '@/components/chatService';
import { AppColors } from '@/constants/theme';

type Meal = {
  id: string;
  foodItems?: string[];
  estimatedCalories?: number;
  macros?: { protein: number; carbs: number; fat: number };
  createdAt?: unknown;
};

type DailyTotals = {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
};

type SectionData = {
  title: string;
  dateKey: string;
  data: Meal[];
  totals: DailyTotals;
};

function formatTime(timestamp: unknown): string {
  if (timestamp == null) return '';
  const ms =
    typeof (timestamp as { toMillis?: () => number }).toMillis === 'function'
      ? (timestamp as { toMillis: () => number }).toMillis()
      : (timestamp as { seconds?: number })?.seconds != null
        ? (timestamp as { seconds: number }).seconds * 1000
        : null;
  if (ms == null || typeof ms !== 'number') return '';
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CHAT_HREF = '/(tabs)/chat' as const;

function chatHrefForMealEdit(mealId: string) {
  return `/(tabs)/chat?mealEdit=${encodeURIComponent(mealId)}`;
}

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMeals(
      (list: Meal[]) => {
        setMeals(list);
        setLoading(false);
        setError(null);
      },
      (err: { message?: string } | null) => {
        setLoading(false);
        setError(err?.message ?? 'Failed to load meals');
      }
    );
    return () => unsubscribe();
  }, []);

  // PR 17: Group meals by date and calculate totals
  const { sections, todayTotals } = useMemo(() => {
    const grouped = groupMealsByDate(meals);
    const todayKey = getTodayDateKey();
    const todayMeals = grouped.get(todayKey) ?? [];
    const todayTotalsCalc = calculateDailyTotals(todayMeals);

    const sectionData: SectionData[] = [];
    grouped.forEach((mealList, dateKey) => {
      sectionData.push({
        title: formatDateKeyForDisplay(dateKey),
        dateKey,
        data: mealList,
        totals: calculateDailyTotals(mealList),
      });
    });

    // Meals with missing/invalid createdAt are skipped by groupMealsByDate — still show them in one section
    if (sectionData.length === 0 && meals.length > 0) {
      sectionData.push({
        title: 'Meals',
        dateKey: 'unscheduled',
        data: meals,
        totals: calculateDailyTotals(meals),
      });
    }

    return { sections: sectionData, todayTotals: todayTotalsCalc };
  }, [meals]);

  const recentMeals = useMemo(() => meals.slice(0, 5), [meals]);

  const renderMealCard = (item: Meal) => (
    <View style={styles.mealCard}>
      <View style={styles.mealCardTop}>
        <Text style={styles.mealTime}>{formatTime(item.createdAt)}</Text>
        <View style={styles.mealActions}>
          <Link href={chatHrefForMealEdit(item.id)} asChild>
            <TouchableOpacity hitSlop={12} accessibilityLabel="Edit meal in chat">
              <Text style={styles.mealActionEdit}>Edit</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
      {item.foodItems && item.foodItems.length > 0 && (
        <Text style={styles.mealItems}>{item.foodItems.join(', ')}</Text>
      )}
      <View style={styles.mealNutrition}>
        {item.estimatedCalories != null && item.estimatedCalories > 0 && (
          <Text style={styles.mealCal}>{item.estimatedCalories} cal</Text>
        )}
        {item.macros && (
          <Text style={styles.mealMacros}>
            P {item.macros.protein}g · C {item.macros.carbs}g · F {item.macros.fat}g
          </Text>
        )}
      </View>
      {(item.estimatedCalories == null || item.estimatedCalories === 0) && !item.macros && (
        <Text style={styles.mealNoNutrition}>No nutrition data</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Loading meals…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, styles.padded]}>
        <Text style={styles.errorTitle}>Couldn&apos;t load meals</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (meals.length === 0) {
    return (
      <View style={[styles.centerContainer, styles.padded]}>
        <Text style={styles.emptyText}>
          No meals logged yet. Log a meal by sending a photo in Chat and confirming with Yes.
        </Text>
        <Link href={CHAT_HREF} asChild>
          <TouchableOpacity style={styles.emptyLogMealButton} activeOpacity={0.85}>
            <Text style={styles.emptyLogMealButtonText}>Log a meal</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.todaySummary}>
              <Text style={styles.todaySummaryTitle}>Today</Text>
              <View style={styles.todaySummaryRow}>
                <View style={styles.todaySummaryCalories}>
                  <Text style={styles.todaySummaryCaloriesValue}>{todayTotals.totalCalories}</Text>
                  <Text style={styles.todaySummaryCaloriesLabel}>calories</Text>
                </View>
                <View style={styles.todaySummaryMacros}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{todayTotals.totalProtein}g</Text>
                    <Text style={styles.macroLabel}>Protein</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{todayTotals.totalCarbs}g</Text>
                    <Text style={styles.macroLabel}>Carbs</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{todayTotals.totalFat}g</Text>
                    <Text style={styles.macroLabel}>Fat</Text>
                  </View>
                </View>
              </View>
              {todayTotals.mealCount === 0 && (
                <Text style={styles.todayNoMeals}>No meals logged today</Text>
              )}
            </View>
            <Link href={CHAT_HREF} asChild>
              <TouchableOpacity style={styles.scanFoodButton} activeOpacity={0.85}>
                <Text style={styles.scanFoodButtonText}>Log a meal</Text>
              </TouchableOpacity>
            </Link>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotals}>
              {section.totals.totalCalories} cal · {section.totals.mealCount} meal
              {section.totals.mealCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        renderItem={({ item }) => renderMealCard(item)}
        stickySectionHeadersEnabled={false}
        ListFooterComponent={
          recentMeals.length > 0 ? (
            <View style={styles.recentSection}>
              <Text style={styles.recentTitle}>Recent</Text>
              {recentMeals.map((meal) => (
                <View key={meal.id} style={styles.recentRow}>
                  <Text style={styles.recentIcon}>🍽</Text>
                  <Text style={styles.recentLabel} numberOfLines={1}>
                    {meal.foodItems?.length ? meal.foodItems.join(', ') : 'Meal'}
                  </Text>
                  <Text style={styles.recentCals}>{meal.estimatedCalories ?? 0} cals</Text>
                  <Link href={chatHrefForMealEdit(meal.id)} asChild>
                    <TouchableOpacity hitSlop={8} accessibilityLabel="Edit meal in chat">
                      <Text style={styles.mealActionEdit}>Edit</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  padded: { paddingHorizontal: 24 },
  loadingText: { color: AppColors.textSecondary, marginTop: 8 },
  errorTitle: { color: '#dc2626', textAlign: 'center', fontWeight: '500', marginBottom: 8 },
  errorText: { color: AppColors.textSecondary, textAlign: 'center', fontSize: 14 },
  emptyText: {
    color: AppColors.textSecondary,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 24,
  },
  emptyLogMealButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyLogMealButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  listContent: { padding: 16, paddingBottom: 24 },
  headerBlock: { marginBottom: 16 },
  todaySummary: {
    backgroundColor: AppColors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
  },
  todaySummaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 16,
  },
  todaySummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -8,
  },
  scanFoodButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  scanFoodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  todaySummaryCalories: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  todaySummaryCaloriesValue: {
    fontSize: 36,
    fontWeight: '700',
    color: AppColors.primary,
  },
  todaySummaryCaloriesLabel: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  todaySummaryMacros: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 8,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
  },
  macroLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  todayNoMeals: {
    fontSize: 14,
    color: AppColors.textSecondary,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  sectionTotals: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  mealCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
  },
  mealCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealActions: { flexDirection: 'row', gap: 16 },
  mealActionEdit: { fontSize: 14, fontWeight: '600', color: AppColors.primary },
  mealTime: { color: AppColors.textSecondary, fontSize: 12 },
  mealItems: { color: AppColors.text, fontWeight: '500', marginBottom: 8 },
  mealNutrition: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  mealCal: { fontSize: 17, fontWeight: '600', color: AppColors.text },
  mealMacros: { fontSize: 15, color: AppColors.textSecondary },
  mealNoNutrition: { fontSize: 14, color: AppColors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  recentSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: AppColors.cardBorder,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 12,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.cardBorder,
  },
  recentIcon: { fontSize: 18, marginRight: 12 },
  recentLabel: { flex: 1, fontSize: 15, color: AppColors.text, marginRight: 8 },
  recentCals: { fontSize: 14, color: AppColors.textSecondary, marginRight: 8 },
});
