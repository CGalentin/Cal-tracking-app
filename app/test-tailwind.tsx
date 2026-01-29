import React from 'react';
import { ScrollView, Text, View } from 'react-native';

export default function TestTailwindScreen() {
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        <Text className="text-3xl font-bold text-blue-600 mb-4">
          Tailwind Test Screen
        </Text>
        
        <View className="bg-blue-100 p-4 rounded-lg mb-4">
          <Text className="text-blue-800 font-semibold">
            ✓ Blue background with rounded corners
          </Text>
        </View>
        
        <View className="bg-green-100 p-4 rounded-lg mb-4">
          <Text className="text-green-800 font-semibold">
            ✓ Green background with rounded corners
          </Text>
        </View>
        
        <View className="bg-purple-100 p-4 rounded-lg mb-4">
          <Text className="text-purple-800 font-semibold">
            ✓ Purple background with rounded corners
          </Text>
        </View>
        
        <View className="border-2 border-gray-300 p-4 rounded-lg mb-4">
          <Text className="text-gray-700">
            ✓ Border styling works
          </Text>
        </View>
        
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-red-200 p-3 rounded">
            <Text className="text-center text-red-800">Flex 1</Text>
          </View>
          <View className="flex-1 bg-yellow-200 p-3 rounded">
            <Text className="text-center text-yellow-800">Flex 1</Text>
          </View>
        </View>
        
        <Text className="text-lg text-gray-600 mt-4">
          If you can see all these styled boxes, Tailwind/NativeWind is working! 🎉
        </Text>
      </View>
    </ScrollView>
  );
}
