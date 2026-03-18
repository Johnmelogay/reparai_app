import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useChatThread } from '@/hooks/useChatThread';
import { toErrorMessage } from '@/utils/error';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, FileText, MessageCircle, Send, Store } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function flowSubtitle(status?: string): string {
  if (status === 'finding') return 'O chat libera após a confirmação do pedido.';
  if (status === 'offered') return 'Escolha uma oferta para continuar o fluxo.';
  if (status === 'accepted') return 'Atendimento confirmado. Use o chat para alinhar detalhes e agendamento.';
  if (status === 'paid') return 'Converse com o prestador sem sair do app.';
  if (status === 'en_route') return 'Use o chat para combinar referência de chegada.';
  if (status === 'completed') return 'Canal aberto para suporte pós-serviço no app.';
  return 'As atualizações aparecem nesta conversa.';
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { thread, messages, loading, error, sending, sendMessage, refetch } = useChatThread(requestId);

  const [inputText, setInputText] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const headerName = thread?.provider?.name || 'Prestador';

  const timelineItems = useMemo(
    () => ['Buscando', 'Ofertas', 'Aceite', 'Pago', 'A caminho', 'Finalizado'],
    []
  );

  const currentStepIndex = useMemo(() => {
    const map: Record<string, number> = {
      finding: 0,
      offered: 1,
      accepted: 2,
      paid: 3,
      en_route: 4,
      completed: 5,
    };
    return map[thread?.status || ''] ?? -1;
  }, [thread?.status]);

  const handleSubmitMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setComposerError(null);

    try {
      await sendMessage(text);
      setInputText('');
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (e) {
      setComposerError(toErrorMessage(e, 'Não foi possível enviar mensagem.'));
    }
  };

  if (!requestId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBlock}>
          <Text style={styles.centerTitle}>Conversa não encontrada</Text>
          <Text style={styles.centerSub}>Pedido inválido para abrir o chat.</Text>
          <Button title="Voltar" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBlock}>
          <Text style={styles.centerTitle}>Carregando conversa...</Text>
          <Text style={styles.centerSub}>Sincronizando mensagens e status.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !thread) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBlock}>
          <AlertCircle size={26} color="#DC2626" />
          <Text style={styles.centerTitle}>Erro ao abrir chat</Text>
          <Text style={styles.centerSub}>{error || 'Pedido não encontrado.'}</Text>
          <Button title="Tentar novamente" onPress={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={Colors.light.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{headerName}</Text>
          <Text style={styles.headerSubtitle}>{flowSubtitle(thread.status)}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push(`/ticket/${thread.requestId}`)} style={styles.headerIconBtn}>
            <FileText size={18} color={Colors.light.textSecondary} />
          </TouchableOpacity>
          {thread.providerId && (
            <TouchableOpacity onPress={() => router.push(`/provider/${thread.providerId}`)} style={styles.headerIconBtn}>
              <Store size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.timelineContainer}>
        {timelineItems.map((label, index) => {
          const isDone = index < currentStepIndex;
          const isActive = index === currentStepIndex;
          const isLast = index === timelineItems.length - 1;
          return (
            <React.Fragment key={label}>
              <View style={styles.timelineItem}>
                <View style={[
                  styles.timelineDot,
                  isDone && styles.timelineDotDone,
                  isActive && styles.timelineDotActive,
                ]} />
                <Text style={[
                  styles.timelineLabel,
                  isDone && styles.timelineLabelDone,
                  isActive && styles.timelineLabelActive,
                ]}>
                  {label}
                </Text>
              </View>
              {!isLast && (
                <View style={[styles.timelineLine, isDone && styles.timelineLineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesListContent}
        renderItem={({ item }) => {
          const outgoing = item.direction === 'outgoing';
          return (
            <View style={[styles.messageRow, outgoing ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
              <View style={[styles.messageBubble, outgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
                <Text style={[styles.messageText, outgoing ? styles.textOutgoing : styles.textIncoming]}>{item.text}</Text>
                <Text style={[styles.messageTime, outgoing ? styles.timeOutgoing : styles.timeIncoming]}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <MessageCircle size={30} color="#CBD5E1" />
            <Text style={styles.emptyMessagesTitle}>Sem mensagens ainda</Text>
            <Text style={styles.emptyMessagesSub}>Inicie a conversa por aqui. Todo atendimento deve ficar dentro do app.</Text>
          </View>
        }
        onContentSizeChange={() => {
          listRef.current?.scrollToEnd({ animated: false });
        }}
        keyboardShouldPersistTaps="handled"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.policyStrip}>
          <Text style={styles.policyText}>Segurança Reparaí: não compartilhe telefone, link ou e-mail. O contato acontece neste chat.</Text>
        </View>

        {composerError ? (
          <View style={styles.composerErrorWrap}>
            <Text style={styles.composerErrorText}>{composerError}</Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, !thread.canSend && styles.inputDisabled]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={thread.status === 'completed' ? 'Atendimento finalizado. Chat encerrado.' : (thread.canSend ? 'Digite sua mensagem...' : 'Chat será liberado após confirmação do pedido')}
            placeholderTextColor="#9CA3AF"
            editable={thread.canSend && !sending}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSubmitMessage}
            style={[styles.sendButton, (!thread.canSend || sending || !inputText.trim()) && styles.sendButtonDisabled]}
            disabled={!thread.canSend || sending || !inputText.trim()}
          >
            {sending ? <Text style={styles.sendButtonText}>...</Text> : <Send size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  centerSub: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  timelineItem: {
    alignItems: 'center',
    width: 48,
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
    borderRadius: 1,
  },
  timelineLineDone: {
    backgroundColor: Colors.light.success,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#D1D5DB',
    marginBottom: 3,
  },
  timelineDotDone: {
    backgroundColor: Colors.light.success,
  },
  timelineDotActive: {
    backgroundColor: Colors.light.primary,
    transform: [{ scale: 1.12 }],
  },
  timelineLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '700',
    textAlign: 'center',
  },
  timelineLabelDone: {
    color: '#334155',
  },
  timelineLabelActive: {
    color: Colors.light.primary,
  },
  messagesListContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 8,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowIncoming: {
    justifyContent: 'flex-start',
  },
  messageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  bubbleIncoming: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 6,
  },
  bubbleOutgoing: {
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textIncoming: {
    color: '#111827',
  },
  textOutgoing: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeIncoming: {
    color: '#94A3B8',
  },
  timeOutgoing: {
    color: 'rgba(255,255,255,0.75)',
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyMessagesTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptyMessagesSub: {
    marginTop: 6,
    fontSize: 13,
    color: '#B0BEC5',
    textAlign: 'center',
    lineHeight: 18,
  },
  policyStrip: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFFBF5',
    borderRadius: 8,
  },
  policyText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
  },
  composerErrorWrap: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  composerErrorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#9CA3AF',
  },
  sendButton: {
    height: 42,
    width: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
