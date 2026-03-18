import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/hooks/useChatInbox';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function statusLabel(status: string): string {
  if (status === 'accepted') return 'Pedido confirmado';
  if (status === 'paid') return 'Pedido confirmado';
  if (status === 'en_route') return 'Prestador a caminho';
  if (status === 'completed') return 'Atendimento finalizado';
  return 'Acompanhando pedido';
}

function formatRelative(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ChatInboxScreen() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const { threads, loading, error, refetch } = useChatInbox();

  if (isGuest) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={['top']}>
        <View style={styles.emptyContainer}>
          <MessageCircle size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Entre para ver suas conversas</Text>
          <Text style={styles.emptySubtext}>O atendimento acontece dentro do chat do app para sua segurança.</Text>
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={() => setShowAuth(true)}>
          <Text style={styles.loginBtnText}>Entrar</Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mensagens</Text>
        <View style={{ width: 24 }} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Falha ao carregar conversas: {error}</Text>
        </View>
      ) : null}

      <FlatList
        data={threads}
        keyExtractor={(item) => item.requestId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => refetch()}
            tintColor={Colors.light.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => router.push(`/chat/${item.requestId}`)}
          >
            <Image
              source={{ uri: item.provider.avatarUrl || 'https://via.placeholder.com/80' }}
              style={styles.avatar}
            />
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <View style={styles.nameRow}>
                  <Text style={styles.providerName} numberOfLines={1}>{item.provider.name}</Text>
                  <Text style={styles.orderIdText}>#{item.requestId.split('-')[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.timestamp}>{formatRelative(item.lastMessageAt || item.updatedAt)}</Text>
              </View>
              <Text style={styles.statusText} numberOfLines={1}>{statusLabel(item.status)}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage || 'Toque para abrir a conversa no app'}
              </Text>
              <Text style={styles.serviceName} numberOfLines={1}>{item.category || item.provider.category || 'Serviço'}</Text>
            </View>
            {item.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MessageCircle size={48} color="#ddd" />
            <Text style={styles.emptyTitle}>Nenhuma conversa ativa</Text>
            <Text style={styles.emptySubtext}>Assim que um pedido for confirmado com prestador, ele aparece aqui.</Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    fontWeight: '700',
    color: Colors.light.text,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
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
    alignItems: 'center',
    marginBottom: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: '#4B5563',
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
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    maxWidth: '88%',
    lineHeight: 20,
  },
  loginBtn: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
});
