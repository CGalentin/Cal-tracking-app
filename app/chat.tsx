import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
  uploadImageAndSendMessage,
} from '@/components/chatService';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  type?: 'text' | 'image';
  imageUrl?: string;
  timestamp?: unknown;
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Initialize conversation and subscribe to messages (history stored in Firestore; only show this session)
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initChat = async () => {
      try {
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

          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        });
      } catch (error) {
        console.error('Error initializing chat:', error);
        setLoading(false);
      }
    };

    initChat();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      await sendMessage(conversationId, 'user', textToSend);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
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
    if (!selectedImageUri || !conversationId) return;
    setUploadingImage(true);
    try {
      await uploadImageAndSendMessage(conversationId, 'user', selectedImageUri);
      setSelectedImageUri(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const renderMessage = ({ item: message }: { item: Message }) => (
    <View className={`mb-4 px-4 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[80%] px-4 py-3 rounded-2xl overflow-hidden ${
          message.role === 'user'
            ? 'bg-blue-500 rounded-br-sm'
            : 'bg-gray-200 rounded-bl-sm'
        }`}>
        {message.type === 'image' && message.imageUrl ? (
          <Image
            source={{ uri: message.imageUrl }}
            style={{ width: 200, height: 200, borderRadius: 8 }}
            contentFit="cover"
          />
        ) : (
          <Text
            className={`text-base ${
              message.role === 'user' ? 'text-white' : 'text-gray-900'
            }`}>
            {message.text}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-500">Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white">
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        className="flex-1 pt-4"
        contentContainerStyle={{
          paddingBottom: 16,
        }}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20 px-4">
            <Text className="text-gray-500 text-center text-lg">
              Start a conversation! Send a message or upload a photo of your meal.
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {selectedImageUri ? (
        <View className="border-t border-gray-200 px-4 py-3 bg-white">
          <View className="flex-row items-center gap-2 mb-2">
            <Image
              source={{ uri: selectedImageUri }}
              style={{ width: 60, height: 60, borderRadius: 8 }}
              contentFit="cover"
            />
            <View className="flex-1">
              <Text className="text-gray-600 text-sm">Photo selected</Text>
              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  onPress={() => setSelectedImageUri(null)}
                  className="px-4 py-2 rounded-lg bg-gray-200">
                  <Text className="text-gray-700 font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSendImage}
                  disabled={uploadingImage}
                  className="px-4 py-2 rounded-lg bg-blue-500">
                  <Text className="text-white font-medium">
                    {uploadingImage ? 'Uploading...' : 'Send photo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View className="border-t border-gray-200 px-4 py-3 bg-white">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={handlePickImage}
            className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-2xl">📷</Text>
          </TouchableOpacity>
          <TextInput
            className="flex-1 border border-gray-300 rounded-full px-4 py-3 text-base"
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim()}
            className={`px-6 py-3 rounded-full ${
              inputText.trim() ? 'bg-blue-500' : 'bg-gray-300'
            }`}>
            <Text className="text-white font-semibold">Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
