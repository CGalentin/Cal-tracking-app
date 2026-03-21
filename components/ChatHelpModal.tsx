import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppColors } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const TIPS: { title: string; body: string }[] = [
  {
    title: 'Logging a meal (text)',
    body: 'Type what you ate in plain language. The assistant parses foods and estimates calories, then asks you to confirm.',
  },
  {
    title: 'Photo meals',
    body: 'Tap 📷, choose a photo, then Send photo. AI describes the meal; tap Yes to log or No to fix it.',
  },
  {
    title: 'Voice input',
    body: 'Tap 🎤 to record. Your speech is transcribed and sent like a typed message.',
  },
  {
    title: 'Corrections',
    body: 'If you tap No, explain what to change (typed or voice). You’ll get an updated description to confirm again.',
  },
  {
    title: 'Home & Meals',
    body: 'Home shows calories remaining vs your target. Meals lists what you’ve logged by day.',
  },
];

export function ChatHelpModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close help" />
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <Text style={styles.sheetTitle}>How to use Chat</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {TIPS.map((tip) => (
              <View key={tip.title} style={styles.tipBlock}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipBody}>{tip.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: AppColors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.cardBorder,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.primary,
  },
  scroll: {
    maxHeight: 480,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  tipBlock: {
    marginBottom: 20,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 6,
  },
  tipBody: {
    fontSize: 15,
    lineHeight: 22,
    color: AppColors.textSecondary,
  },
});
