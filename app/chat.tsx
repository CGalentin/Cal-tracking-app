import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
    getOrCreateConversation,
    sendMessage,
    subscribeToMessages,
} from '@/components/chatService';

export default function ChatScreen() {
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; text: string; timestamp?: any }>>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Initialize conversation and subscribe to messages
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initChat = async () => {
      try {
        const convId = await getOrCreateConversation();
        setConversationId(convId);

        // Subscribe to messages
        unsubscribe = subscribeToMessages(convId, (firestoreMessages) => {
          setMessages(firestoreMessages);
          setLoading(false);
          
          // Auto-scroll to bottom when new messages arrive
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
    setInputText(''); // Clear input immediately for better UX

    try {
      await sendMessage(conversationId, 'user', textToSend);
      // Messages will update automatically via the Firestore listener
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally show error to user
    }
  };

  const renderMessage = ({ item: message }: { item: typeof messages[0] }) => (
    <View className={`mb-4 px-4 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          message.role === 'user'
            ? 'bg-blue-500 rounded-br-sm'
            : 'bg-gray-200 rounded-bl-sm'
        }`}>
        <Text
          className={`text-base ${
            message.role === 'user' ? 'text-white' : 'text-gray-900'
          }`}>
          {message.text}
        </Text>
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

      <View className="border-t border-gray-200 px-4 py-3 bg-white">
        <View className="flex-row items-center gap-2">
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
