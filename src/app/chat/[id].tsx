import { Colors } from '@/constants/Colors';
import { REQUESTS } from '@/services/mockData';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_MESSAGES = [
    { id: '1', text: 'Olá! Vi seu pedido de manutenção.', sender: 'provider', time: '10:00' },
    { id: '2', text: 'Oi! Sim, preciso com urgência.', sender: 'user', time: '10:05' },
    { id: '3', text: 'Posso chegar aí em 30 minutos?', sender: 'provider', time: '10:06' },
];

export default function ChatRoomScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const request = REQUESTS.find(r => r.id === id);

    useEffect(() => {
        // Load messages (in real app, filter by chat ID)
        setMessages(MOCK_MESSAGES);
    }, [id]);

    const sendMessage = () => {
        if (inputText.trim().length === 0) return;

        const newMessage = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages([...messages, newMessage]);
        setInputText('');

        // Mock reply
        setTimeout(() => {
            const reply = {
                id: (Date.now() + 1).toString(),
                text: 'Combinado! Estou saindo agora.',
                sender: 'provider',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, reply]);
        }, 2000);
    };

    const renderItem = ({ item }: { item: any }) => {
        const isUser = item.sender === 'user';
        return (
            <View style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.providerBubble
            ]}>
                <Text style={[
                    styles.messageText,
                    isUser ? styles.userText : styles.providerText
                ]}>{item.text}</Text>
                <Text style={[
                    styles.timeText,
                    isUser ? styles.userTime : styles.providerTime
                ]}>{item.time}</Text>
            </View>
        );
    };

    if (!request) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={{ textAlign: 'center', marginTop: 20 }}>Conversa não encontrada.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.light.primary} />
                </TouchableOpacity>
                <Image source={{ uri: request.image }} style={styles.avatar} />
                <View style={{ marginLeft: 10 }}>
                    <Text style={styles.headerTitle}>{request.providerName}</Text>
                    <Text style={styles.headerSubtitle}>
                        {request.status === 'In Progress' ? 'Online agora' : 'Serviço finalizado'}
                    </Text>
                </View>
            </View>

            <View style={styles.safetyBanner}>
                <Text style={styles.safetyText}>🛡️ Monitorado por IA. Não envie senhas ou dados sensíveis.</Text>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Digite sua mensagem..."
                        placeholderTextColor="#999"
                    />
                    <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                        <Send size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: '#fff',
    },
    safetyBanner: {
        backgroundColor: '#F0F9E6',
        padding: 8,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#DEE8D6',
    },
    safetyText: {
        fontSize: 12,
        color: '#5B6A57',
        fontWeight: '600',
    },
    backButton: {
        marginRight: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eee',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.light.success,
    },
    listContent: {
        padding: 16,
        paddingBottom: 20,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 20,
        marginBottom: 8,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: Colors.light.primary,
        borderBottomRightRadius: 4,
    },
    providerBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#F3F4F6',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
    },
    userText: {
        color: '#fff',
    },
    providerText: {
        color: '#333',
    },
    timeText: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    userTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    providerTime: {
        color: '#999',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    input: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 10,
        fontSize: 16,
        color: '#333',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
