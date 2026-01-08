import { Colors } from '@/constants/Colors';
import { REQUESTS } from '@/services/mockData';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatInboxScreen() {
    const router = useRouter();

    // Filter logic: Only 'In Progress' (On the way) or 'Completed' (Done)
    const validChats = REQUESTS.filter(r =>
        r.status === 'In Progress' || r.status === 'Completed'
    );

    const renderItem = ({ item }: { item: typeof REQUESTS[0] }) => (
        <TouchableOpacity
            style={styles.chatItem}
            onPress={() => router.push(`/chat/${item.id}`)}
        >
            <Image source={{ uri: item.image }} style={styles.avatar} />
            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text style={styles.providerName}>{item.providerName}</Text>
                    <Text style={styles.timestamp}>10:30</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.status === 'In Progress' ? 'Estou a caminho!' : 'Obrigado pelo serviço!'}
                </Text>
                <Text style={styles.serviceName}>{item.service}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mensagens</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={validChats}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MessageCircle size={48} color="#ddd" />
                        <Text style={styles.emptyText}>Nenhuma conversa ativa.</Text>
                        <Text style={styles.emptySubtext}>
                            O chat só fica disponível durante ou após o serviço.
                        </Text>
                    </View>
                }
            />
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
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    listContent: {
        padding: 20,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#eee',
    },
    chatInfo: {
        flex: 1,
        marginLeft: 15,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    providerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    serviceName: {
        fontSize: 10,
        color: Colors.light.textSecondary,
        backgroundColor: Colors.light.background,
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 20,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        maxWidth: '80%',
    }
});
