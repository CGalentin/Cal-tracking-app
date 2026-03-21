import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setHasSeenFeatureTour } from '@/components/featureTourStorage';
import { AppColors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = { title: string; body: string; emoji: string };

const SLIDES: Slide[] = [
  {
    emoji: '💬',
    title: 'Chat with your coach',
    body: 'Describe what you ate in your own words. The assistant estimates calories and macros from your text.',
  },
  {
    emoji: '📷',
    title: 'Photo & voice',
    body: 'Tap the camera to send a meal photo for AI recognition. Use the mic to speak instead of typing.',
  },
  {
    emoji: '✅',
    title: 'Confirm your meal',
    body: 'When the assistant asks if the description matches, tap Yes to log it or No to correct it.',
  },
  {
    emoji: '🏠',
    title: 'Home & Meals',
    body: 'Track calories remaining on Home. Browse logged meals by day on the Meals tab.',
  },
];

export default function FeatureTourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const finish = useCallback(async () => {
    await setHasSeenFeatureTour();
    router.replace(Platform.OS !== 'web' ? '(tabs)' : '/(tabs)');
  }, [router]);

  const skip = useCallback(() => {
    void finish();
  }, [finish]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(i);
  }, []);

  const goNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      void finish();
    }
  }, [index, finish]);

  const renderSlide = useCallback(({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH, paddingTop: insets.top + 24 }]}>
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  ), [insets.top]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
      <Pressable onPress={skip} style={[styles.skip, { top: insets.top + 8 }]}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={goNext}>
        <Text style={styles.primaryButtonText}>
          {index < SLIDES.length - 1 ? 'Next' : 'Get started'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  skip: {
    position: 'absolute',
    right: 20,
    zIndex: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: AppColors.cardBorder,
  },
  dotActive: {
    backgroundColor: AppColors.primary,
    width: 22,
  },
  primaryButton: {
    marginHorizontal: 24,
    backgroundColor: AppColors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
