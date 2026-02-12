import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import { subscribeToMeals } from '@/components/chatService';

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
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-gray-500 mt-2">Loading meals…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-red-600 text-center font-medium mb-2">Couldn&apos;t load meals</Text>
        <Text className="text-gray-600 text-center text-sm">{error}</Text>
      </View>
    );
  }

  if (meals.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-gray-600 text-center text-lg">
          No meals logged yet. Log a meal by sending a photo in Chat and confirming with Yes.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={meals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <Text className="text-gray-500 text-sm mb-1">{formatDate(item.createdAt)}</Text>
            {item.foodItems && item.foodItems.length > 0 && (
              <Text className="text-gray-800 font-medium mb-2">{item.foodItems.join(', ')}</Text>
            )}
            <View className="flex-row flex-wrap gap-2">
              {item.estimatedCalories != null && (
                <Text className="text-base text-gray-900">{item.estimatedCalories} cal</Text>
              )}
              {item.macros && (
                <Text className="text-sm text-gray-600">
                  P {item.macros.protein}g · C {item.macros.carbs}g · F {item.macros.fat}g
                </Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}
