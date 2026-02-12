// chatService.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from './firebaseConfig';

/**
 * Get or create a conversation document for the current user
 * Returns the conversation ID
 */
export const getOrCreateConversation = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('User must be authenticated');

  const conversationId = user.uid; // One conversation per user
  const conversationRef = doc(db, 'conversations', conversationId);

  const conversationSnap = await getDoc(conversationRef);
  if (!conversationSnap.exists()) {
    // Create new conversation
    await setDoc(conversationRef, {
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return conversationId;
};

/**
 * Subscribe to messages in a conversation
 * Returns an unsubscribe function
 */
export const subscribeToMessages = (conversationId, callback) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(messages);
  });
};

/**
 * Send a text message to Firestore
 */
export const sendMessage = async (conversationId, role, text) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(messagesRef, {
    role,
    text,
    type: 'text',
    timestamp: serverTimestamp(),
  });
};

/**
 * Upload image to Firebase Storage and save image message in Firestore
 * @param {string} conversationId
 * @param {string} role - 'user' or 'assistant'
 * @param {string} uri - local file URI (e.g. from ImagePicker)
 * @returns {Promise<string>} download URL
 */
export const uploadImageAndSendMessage = async (conversationId, role, uri) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User must be authenticated');

  const filename = `images/${conversationId}/${Date.now()}.jpg`;
  const storageRef = ref(storage, filename);

  const response = await fetch(uri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob);
  const imageUrl = await getDownloadURL(storageRef);

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(messagesRef, {
    role,
    type: 'image',
    text: '',
    imageUrl,
    timestamp: serverTimestamp(),
  });

  return imageUrl;
};

/**
 * Delete all messages in a conversation (clears chat history)
 */
export const clearAllMessages = async (conversationId) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const snapshot = await getDocs(messagesRef);
  const deletes = snapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletes);
};

/**
 * Subscribe to logged meals for the current user (for Meals tab).
 * Returns an unsubscribe function.
 * Uses where('userId', '==') only so no composite index is required; sorts by createdAt in memory.
 */
export const subscribeToMeals = (callback, onError) => {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }
  const mealsRef = collection(db, 'meals');
  const q = query(mealsRef, where('userId', '==', user.uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const meals = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
          const bMs = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
          return bMs - aMs;
        });
      callback(meals);
    },
    (err) => {
      if (typeof onError === 'function') onError(err);
      callback([]);
    }
  );
};
