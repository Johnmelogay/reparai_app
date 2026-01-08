import { Colors } from '@/constants/Colors';
import { Bell } from 'lucide-react-native';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NOTIFICATIONS = [
    { id: '1', title: 'Pedido Aceito', body: 'João aceitou seu pedido de manutenção.', time: '2 min atrás', read: false },
    { id: '2', title: 'Promoção', body: 'Ganhe 10% de desconto no próximo serviço!', time: '1h atrás', read: true },
];

export default function NotificationsScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Text style={styles.title}>Notificações</Text>
            <FlatList
                data={NOTIFICATIONS}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
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
