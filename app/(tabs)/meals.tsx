import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { subscribeToMeals } from '@/components/chatService';
import { AppColors } from '@/constants/theme';

type Meal = {
  id: string;
  foodItems?: string[];
  estimatedCalories?: number;
  macros?: { protein: number; carbs: number; fat: number };
  createdAt?: unknown;
};

function formatDate(timestamp: unknown): string {
  if (timestamp == null) return '—';
  const ms =
    typeof (timestamp as { toMillis?: () => number }).toMillis === 'function'
      ? (timestamp as { toMillis: () => number }).toMillis()
      : (timestamp as { seconds?: number })?.seconds != null
        ? (timestamp as { seconds: number }).seconds * 1000
        : null;
  if (ms == null || typeof ms !== 'number') return '—';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMeals(
      (list) => {
        setMeals(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err?.message ?? 'Failed to load meals');
      }
    );
    return () => unsubscribe();
  }, []);

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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={meals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.mealCard}>
            <Text style={styles.mealDate}>{formatDate(item.createdAt)}</Text>
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
        )}
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
  },
  listContent: { padding: 16, paddingBottom: 24 },
  mealCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
  },
  mealDate: { color: AppColors.textSecondary, fontSize: 12, marginBottom: 4 },
  mealItems: { color: AppColors.text, fontWeight: '500', marginBottom: 8 },
  mealNutrition: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  mealCal: { fontSize: 17, fontWeight: '600', color: AppColors.text },
  mealMacros: { fontSize: 15, color: AppColors.textSecondary },
  mealNoNutrition: { fontSize: 14, color: AppColors.textSecondary, fontStyle: 'italic', marginTop: 4 },
});
