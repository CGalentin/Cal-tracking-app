import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { ChatHelpModal } from '@/components/ChatHelpModal';
import {
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
  transcribeAudio,
  uploadImageAndSendMessage,
} from '@/components/chatService';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EXAMPLE_MEAL_PROMPTS } from '@/constants/examplePrompts';
import { AppColors } from '@/constants/theme';
import { getUserFriendlyMessage } from '@/utils/errorMessages';

type Macros = { protein: number; carbs: number; fat: number };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  type?: 'text' | 'image' | 'confirmation';
  imageUrl?: string;
  timestamp?: unknown;
  mealLogged?: boolean;
  estimatedCalories?: number;
  macros?: Macros;
  foodItems?: string[];
  isCorrectionUpdate?: boolean;
};

export default function ChatScreen() {
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const [helpVisible, setHelpVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [processingCorrection, setProcessingCorrection] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lastUploadError, setLastUploadError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const sessionStartRef = useRef<number>(Date.now());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setHelpVisible(true)}
          style={{ marginRight: 16, padding: 4 }}
          accessibilityLabel="Chat help">
          <IconSymbol name="questionmark.circle" size={26} color={AppColors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  // Initialize conversation and subscribe to messages (history stored in Firestore; only show this session)
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initChat = async () => {
      try {
        setInitError(null);
        sessionStartRef.current = Date.now();
        const convId = await getOrCreateConversation();
        setConversationId(convId);

        unsubscribe = subscribeToMessages(convId, (firestoreMessages) => {
          const sessionStart = sessionStartRef.current;
          const sessionMessages = firestoreMessages.filter((m) => {
            const ts = m.timestamp;
            if (ts == null) return true;
            const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : ts?.seconds * 1000;
            return typeof ms === 'number' && ms >= sessionStart;
          });
          setMessages(sessionMessages);
          setLoading(false);
          if (sessionMessages.length > 0 && sessionMessages[sessionMessages.length - 1].role === 'assistant') {
            setProcessingCorrection(false);
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });
      } catch (error) {
        console.error('Error initializing chat:', error);
        setInitError(getUserFriendlyMessage(error, 'generic'));
        setLoading(false);
      }
    };

    initChat();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [retryKey]);

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId || sendingMessage) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSendingMessage(true);

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user' && lastMsg?.text === 'No') {
      setProcessingCorrection(true);
    }

    try {
      await sendMessage(conversationId, 'user', textToSend);
    } catch (error) {
      setProcessingCorrection(false);
      console.error('Error sending message:', error);
      const msg = getUserFriendlyMessage(error, 'message');
      Alert.alert('Could not send', msg, [
        { text: 'OK' },
        { text: 'Retry', onPress: () => setInputText(textToSend) },
      ]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleConfirmation = async (response: 'Yes' | 'No') => {
    if (!conversationId || confirming) return;
    setConfirming(true);
    try {
      await sendMessage(conversationId, 'user', response);
    } catch (error) {
      console.error('Error sending confirmation:', error);
      const msg = getUserFriendlyMessage(error, 'message');
      Alert.alert('Could not send', msg, [
        { text: 'OK' },
        { text: 'Retry', onPress: () => handleConfirmation(response) },
      ]);
    } finally {
      setConfirming(false);
    }
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload images.');
      return false;
    }
    return true;
  };

  const handlePickImage = async () => {
    if (!conversationId) return;
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setSelectedImageUri(uri);
  };

  const handleSendImage = async () => {
    if (!selectedImageUri || !conversationId || uploadingImage) return;
    setUploadingImage(true);
    setLastUploadError(null);
    try {
      await uploadImageAndSendMessage(conversationId, 'user', selectedImageUri);
      setSelectedImageUri(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      const msg = getUserFriendlyMessage(error, 'upload');
      setLastUploadError(msg);
      Alert.alert('Upload failed', msg, [
        { text: 'Cancel', onPress: () => setSelectedImageUri(null) },
        { text: 'Retry', onPress: () => handleSendImage() },
      ]);
    } finally {
      setUploadingImage(false);
    }
  };

  const requestMicPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Microphone access needed',
        'Please allow microphone access to record voice messages.'
      );
      return false;
    }
    return true;
  };

  const handleStartRecording = async () => {
    if (!conversationId) return;
    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const handleStopRecording = async () => {
    if (!recordingRef.current || !conversationId) return;
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) {
        Alert.alert('Error', 'No recording available.');
        return;
      }
      setTranscribing(true);
      const transcript = await transcribeAudio(conversationId, uri);
      setTranscribing(false);
      if (transcript.trim()) {
        // PR 14: If last message was "No", this is a correction — show processing state
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'user' && lastMsg?.text === 'No') {
          setProcessingCorrection(true);
        }
        await sendMessage(conversationId, 'user', transcript.trim());
      } else {
        Alert.alert(
          'No speech detected',
          'Could not hear any words. Please try again or type your message.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      setTranscribing(false);
      setProcessingCorrection(false);
      console.error('Error transcribing:', error);
      const msg = getUserFriendlyMessage(error, 'transcription');
      Alert.alert('Transcription failed', msg, [{ text: 'OK' }]);
    }
  };

  const handleMicPress = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  const renderMessage = ({ item: message, index }: { item: Message; index: number }) => {
    const nextMessage = messages[index + 1];
    const isConfirmationMessage =
      message.role === 'assistant' &&
      (message.type === 'confirmation' || String(message.text || '').includes('Does this description match your meal'));
    const showConfirmationButtons =
      isConfirmationMessage &&
      (nextMessage == null || nextMessage.role !== 'user');

    const isUser = message.role === 'user';
    const bubbleStyle = isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant;
    const textStyle = isUser ? styles.messageTextUser : styles.messageTextAssistant;

    return (
      <View style={[styles.messageRow, { width: screenWidth }]}>
        <View style={styles.messageContainer}>
          <Text style={[styles.messageLabel, isUser ? styles.messageLabelUser : styles.messageLabelAssistant]}>
            {isUser ? 'You' : 'Assistant'}
          </Text>
          <View style={[styles.messageBubble, bubbleStyle]}>
            {message.type === 'image' && message.imageUrl ? (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: message.imageUrl }}
                  style={[
                    styles.messageImage,
                    {
                      width: Math.min(200, screenWidth * 0.6),
                      height: Math.min(200, screenWidth * 0.6),
                    },
                  ]}
                  contentFit="cover"
                />
              </View>
            ) : message.mealLogged ? (
              <View style={styles.mealLoggedCard}>
                <Text style={styles.mealLoggedTitle}>Meal logged</Text>
                <View style={styles.mealLoggedNutrition}>
                  {message.estimatedCalories != null && message.estimatedCalories > 0 && (
                    <Text style={styles.mealLoggedCal}>
                      {message.estimatedCalories} cal
                    </Text>
                  )}
                  {message.macros && (
                    <Text style={styles.mealLoggedMacros}>
                      P {message.macros.protein}g · C {message.macros.carbs}g · F {message.macros.fat}g
                    </Text>
                  )}
                </View>
                {(message.estimatedCalories == null || message.estimatedCalories === 0) && !message.macros && (
                  <Text style={[styles.messageText, textStyle]}>{message.text}</Text>
                )}
              </View>
            ) : message.isCorrectionUpdate || (message.foodItems?.length && message.text?.startsWith('Updated:')) ? (
              <View style={styles.correctionUpdateCard}>
                <Text style={styles.correctionUpdateTitle}>Updated</Text>
                {message.foodItems && message.foodItems.length > 0 && (
                  <Text style={styles.correctionUpdateFoods}>{message.foodItems.join(', ')}</Text>
                )}
                <View style={styles.correctionUpdateNutrition}>
                  {message.estimatedCalories != null && message.estimatedCalories > 0 && (
                    <Text style={styles.mealLoggedCal}>{message.estimatedCalories} cal</Text>
                  )}
                  {message.macros && (
                    <Text style={styles.mealLoggedMacros}>
                      P {message.macros.protein}g · C {message.macros.carbs}g · F {message.macros.fat}g
                    </Text>
                  )}
                </View>
                {(!message.estimatedCalories || message.estimatedCalories === 0) && !message.macros && (
                  <Text style={[styles.messageText, textStyle]}>{message.text}</Text>
                )}
              </View>
            ) : (
              <Text
                style={[styles.messageText, textStyle]}
              >
                {message.text}
              </Text>
            )}
          </View>
          {showConfirmationButtons && (
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                onPress={() => handleConfirmation('Yes')}
                disabled={confirming}
                style={[styles.confirmButton, confirming && styles.buttonDisabled]}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.confirmButtonText}>{confirming ? '…' : 'Yes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleConfirmation('No')}
                disabled={confirming}
                style={[styles.declineButton, confirming && styles.buttonDisabled]}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.declineButtonText}>{confirming ? '…' : 'No'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={[styles.loadingText, { marginTop: 16 }]}>Loading chat...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { textAlign: 'center', marginBottom: 16 }]}>{initError}</Text>
        <TouchableOpacity
          style={[styles.sendButton, { marginTop: 8 }]}
          onPress={() => { setLoading(true); setRetryKey((k) => k + 1); }}
        >
          <Text style={styles.sendButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ChatHelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Start a conversation! Send a message or upload a photo of your meal.
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {selectedImageUri ? (
        <View style={styles.photoPreviewContainer}>
          <View style={styles.photoPreviewRow}>
            <Image
              source={{ uri: selectedImageUri }}
              style={{ width: 64, height: 64, borderRadius: 12 }}
              contentFit="cover"
            />
            <View style={styles.photoPreviewActions}>
              <Text style={styles.photoPreviewLabel}>
                {lastUploadError ? 'Upload failed – tap Retry' : 'Photo selected'}
              </Text>
              <View style={styles.photoPreviewButtons}>
                <TouchableOpacity
                  onPress={() => { setSelectedImageUri(null); setLastUploadError(null); }}
                  style={styles.cancelButton}
                  disabled={uploadingImage}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSendImage}
                  disabled={uploadingImage}
                  style={[styles.sendPhotoButton, uploadingImage && styles.buttonDisabled]}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#ffffff" style={{ paddingVertical: 4 }} />
                  ) : (
                    <Text style={styles.sendPhotoButtonText}>
                      {lastUploadError ? 'Retry' : 'Send photo'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {messages.length === 0 && !selectedImageUri ? (
        <View style={styles.promptsSection}>
          <Text style={styles.promptsLabel}>Try an example</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promptsRow}>
            {EXAMPLE_MEAL_PROMPTS.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                style={styles.promptChip}
                onPress={() => setInputText(prompt)}
                activeOpacity={0.85}>
                <Text style={styles.promptChipText} numberOfLines={2}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.inputBarContainer}>
        <View style={styles.inputRow}>
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={isRecording || transcribing || processingCorrection || sendingMessage || confirming}
            style={styles.iconButton}>
            <Text style={styles.iconText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleMicPress}
            disabled={!!selectedImageUri || transcribing || processingCorrection || sendingMessage || confirming}
            style={[styles.iconButton, isRecording && styles.iconButtonRecording]}>
            <Text style={styles.iconText}>{isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder={
              isRecording
                ? 'Listening...'
                : transcribing
                  ? 'Transcribing...'
                  : processingCorrection
                    ? 'Processing correction…'
                    : messages.length > 0 &&
                        messages[messages.length - 1]?.role === 'assistant' &&
                        String(messages[messages.length - 1]?.text || '').includes('What would you like to correct')
                      ? 'Type or speak your correction...'
                      : 'Type a message...'
            }
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            editable={!isRecording && !transcribing && !processingCorrection && !sendingMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || processingCorrection || sendingMessage}
            style={[
              styles.sendButton,
              (!inputText.trim() || sendingMessage) && styles.sendButtonDisabled,
            ]}>
            {sendingMessage ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  loadingText: {
    color: AppColors.textSecondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 4,
    paddingTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 96,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: AppColors.textSecondary,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  messageRow: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  messageContainer: {
    paddingHorizontal: 16,
    maxWidth: '90%',
    flexDirection: 'column',
    alignItems: 'center',
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageLabelUser: {
    color: '#007AFF',
  },
  messageLabelAssistant: {
    color: '#6b7280',
  },
  messageBubble: {
    maxWidth: '100%',
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    }),
  },
  messageBubbleUser: {
    backgroundColor: '#007AFF',
  },
  messageBubbleAssistant: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  mealLoggedCard: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  mealLoggedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    marginBottom: 8,
  },
  mealLoggedNutrition: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  mealLoggedCal: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
  },
  mealLoggedMacros: {
    fontSize: 15,
    color: AppColors.textSecondary,
  },
  correctionUpdateCard: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  correctionUpdateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
    marginBottom: 6,
  },
  correctionUpdateFoods: {
    fontSize: 15,
    color: AppColors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  correctionUpdateNutrition: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  imageWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageImage: {
    borderRadius: 8,
  },
  messageText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  messageTextUser: {
    color: '#ffffff',
    fontWeight: '500',
  },
  messageTextAssistant: {
    color: '#1f2937',
    fontWeight: '400',
  },
  photoPreviewContainer: {
    borderTopWidth: 1,
    borderTopColor: AppColors.cardBorder,
    backgroundColor: AppColors.backgroundAlt,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptsSection: {
    borderTopWidth: 1,
    borderTopColor: AppColors.cardBorder,
    backgroundColor: AppColors.backgroundAlt,
    paddingVertical: 12,
    paddingLeft: 16,
  },
  promptsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginBottom: 10,
  },
  promptsRow: {
    flexDirection: 'row',
    paddingRight: 16,
    alignItems: 'stretch',
  },
  promptChip: {
    maxWidth: 220,
    marginRight: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
  },
  promptChipText: {
    fontSize: 14,
    color: AppColors.text,
    lineHeight: 20,
  },
  inputBarContainer: {
    borderTopWidth: 1,
    borderTopColor: AppColors.cardBorder,
    backgroundColor: AppColors.backgroundAlt,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  photoPreviewActions: {
    gap: 8,
  },
  photoPreviewLabel: {
    color: AppColors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  photoPreviewButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
  },
  cancelButtonText: {
    color: AppColors.text,
    fontWeight: '500',
  },
  sendPhotoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AppColors.primary,
  },
  sendPhotoButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonRecording: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  iconText: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: AppColors.card,
  },
  sendButton: {
    minWidth: 72,
    height: 48,
    borderRadius: 16,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmationButtons: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 20,
    marginTop: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  confirmButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    }),
  },
  declineButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#e91640',
    borderWidth: 1,
    borderColor: '#e91640',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3,
    }),
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
