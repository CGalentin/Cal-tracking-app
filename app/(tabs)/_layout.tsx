import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { logOut } from '@/components/authService';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const handleLogout = async () => {
    await logOut();
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        headerShown: true,
        headerStyle: { backgroundColor: '#007AFF' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        headerRight: () => (
          <Pressable onPress={handleLogout} style={{ marginRight: 16 }}>
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Log out</Text>
          </Pressable>
        ),
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="fork.knife" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
