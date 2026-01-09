import { Colors } from '@/constants/Colors';
import { Bell } from 'lucide-react-native';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { TouchableOpacity } from 'react-native';

// TODO: Connect to Real Notification Service
const NOTIFICATIONS: any[] = [];

export default function NotificationsScreen() {
    const { isGuest } = useAuth();
    const [showAuth, setShowAuth] = useState(false);

    if (isGuest) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]} edges={['top']}>
                <View style={{ alignItems: 'center', marginBottom: 40 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <Bell size={40} color="#9CA3AF" />
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 10 }}>Notificações</Text>
                    <Text style={{ textAlign: 'center', color: '#666', fontSize: 16, lineHeight: 24 }}>
                        Faça login para receber atualizações sobre seus pedidos e promoções.
                    </Text>
                </View>

                <TouchableOpacity
                    style={{ backgroundColor: Colors.light.primary, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center' }}
                    onPress={() => setShowAuth(true)}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Entrar</Text>
                </TouchableOpacity>

                <AuthBottomSheet
                    visible={showAuth}
                    onClose={() => setShowAuth(false)}
                    onSuccess={() => setShowAuth(false)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Text style={styles.title}>Notificações</Text>
            <FlatList
                data={NOTIFICATIONS}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Text style={{ color: '#999', fontSize: 16 }}>Nenhuma notificação nova.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={[styles.item, !item.read && styles.unread]}>
                        <View style={styles.iconContainer}>
                            <Bell size={20} color={!item.read ? Colors.light.primary : '#999'} />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            <Text style={styles.itemBody}>{item.body}</Text>
                            <Text style={styles.itemTime}>{item.time}</Text>
                        </View>
                        {!item.read && <View style={styles.dot} />}
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginHorizontal: 20,
        marginVertical: 20,
    },
    listContent: {
        paddingHorizontal: 20,
    },
    item: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'flex-start',
    },
    unread: {
        backgroundColor: '#F0F9FF',
    },
    iconContainer: {
        marginRight: 12,
        marginTop: 2,
    },
    textContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    itemBody: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    itemTime: {
        fontSize: 12,
        color: '#999',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.primary,
        marginTop: 6,
    },
});
