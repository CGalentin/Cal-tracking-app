import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/constants/storageKeys';

export async function getHasSeenFeatureTour(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_FEATURE_TOUR);
    return v === 'true';
  } catch {
    return true;
  }
}

export async function setHasSeenFeatureTour(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_FEATURE_TOUR, 'true');
  } catch {
    /* ignore */
  }
}

export async function clearFeatureTourFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.HAS_SEEN_FEATURE_TOUR);
  } catch {
    /* ignore */
  }
}
