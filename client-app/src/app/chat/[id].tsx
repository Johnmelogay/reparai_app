import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useChatThread } from '@/hooks/useChatThread';
import { supabase } from '@/services/supabase';
import { toErrorMessage } from '@/utils/error';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, Check, CheckCheck, CheckCircle, FileText, HeadphonesIcon, MessageCircle, Send, Star, Store } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

function flowSubtitle(status?: string, doneProviderAt?: string | null): string {
  if (status === 'finding') return 'O chat libera após a confirmação do pedido.';
  if (status === 'offered') return 'Escolha uma oferta para continuar o fluxo.';
  if (status === 'accepted' || status === 'confirmed') return 'Atendimento confirmado. Use o chat para alinhar detalhes.';
  if (status === 'en_route') return 'Prestador a caminho. Use o chat para combinar referência de chegada.';
  if (status === 'arrived') return 'Prestador no local. Converse e acompanhe o orçamento.';
  if (status === 'quote_provided') return 'Orçamento disponível para aprovação.';
  if (status === 'quote_accepted') {
    if (doneProviderAt) {
      return 'Prestador finalizou o serviço. Confirme para concluir.';
    }
    return 'Serviço em execução.';
  }
  if (status === 'done' || status === 'completed') return 'Pedido finalizado. Histórico da conversa disponível.';
  return 'As atualizações aparecem nesta conversa.';
}

function inputPlaceholder(status?: string, canSend?: boolean): string {
  if (status === 'done' || status === 'completed') return 'Pedido encerrado. Use o suporte para dúvidas.';
  if (canSend) return 'Digite sua mensagem...';
  return 'Chat liberado após confirmação do pedido.';
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

type MergedItem =
  | { type: 'message'; id: string; data: ReturnType<typeof useChatThread>['messages'][number] }
  | { type: 'confirm_request'; id: string }
  | { type: 'review_request'; id: string };

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Star
            size={32}
            color={n <= value ? '#F59E0B' : '#D1D5DB'}
            fill={n <= value ? '#F59E0B' : 'transparent'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { thread, messages, loading, error, sending, sendMessage, refetch } = useChatThread(requestId);

  const [inputText, setInputText] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const listRef = useRef<FlatList>(null);

  const handleConfirmDone = async () => {
    if (!requestId || confirmSubmitting) return;
    setConfirmSubmitting(true);
    try {
      const { error: err } = await supabase.rpc('client_confirm_done', { p_request_id: requestId });
      if (err) throw err;
      setClientConfirmed(true);
      refetch();
    } catch (e: any) {
      setComposerError(e?.message || 'Erro ao confirmar conclusão.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!requestId || reviewRating === 0 || reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      const { error: err } = await supabase.rpc('submit_review', {
        p_request_id: requestId,
        p_rating: reviewRating,
        p_comment: reviewComment.trim() || null,
      });
      if (err) throw err;

      setReviewDone(true);
      refetch();
    } catch (e: any) {
      setComposerError(e?.message || 'Erro ao enviar avaliação.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const headerName = thread?.provider?.name || 'Prestador';

  // Build merged list: messages → confirm bubble → review bubble
  const mergedData = useMemo<MergedItem[]>(() => {
    const items: MergedItem[] = messages.map((m) => ({ type: 'message', id: m.id, data: m }));
    if (!thread?.doneProviderAt) return items;

    const clientHasConfirmed = clientConfirmed || !!thread.doneClientAt;

    if (!clientHasConfirmed) {
      items.push({ type: 'confirm_request', id: '__confirm__' });
    } else if (!thread.hasClientReview && !reviewDone) {
      items.push({ type: 'review_request', id: '__review__' });
    }
    return items;
  }, [messages, thread?.doneProviderAt, thread?.doneClientAt, thread?.hasClientReview, clientConfirmed, reviewDone]);

  const timelineItems = useMemo(
    () => ['Confirmado', 'A caminho', 'No local', 'Em execução', 'Concluído'],
    []
  );

  const currentStepIndex = useMemo(() => {
    const map: Record<string, number> = {
      accepted: 0,
      confirmed: 0,
      en_route: 1,
      arrived: 2,
      quote_provided: 2,
      quote_accepted: 3,
      done: 4,
      completed: 4,
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/home');
  };

  if (!requestId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBlock}>
          <Text style={styles.centerTitle}>Conversa não encontrada</Text>
          <Text style={styles.centerSub}>Pedido inválido para abrir o chat.</Text>
          <Button title="Voltar" variant="outline" onPress={handleBack} />
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
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={22} color={Colors.light.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{headerName}</Text>
          <Text style={styles.headerSubtitle}>{flowSubtitle(thread.status, thread.doneProviderAt)}</Text>
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
          <TouchableOpacity
            onPress={() => router.push('/profile/help' as any)}
            style={[styles.headerIconBtn, styles.supportBtn]}
          >
            <HeadphonesIcon size={18} color="#fff" />
          </TouchableOpacity>
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
        data={mergedData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesListContent}
        renderItem={({ item }) => {
          if (item.type === 'confirm_request') {
            return (
              <View style={styles.reviewBubble}>
                <View style={styles.reviewBubbleHeader}>
                  <CheckCircle size={18} color="#2563EB" />
                  <Text style={[styles.reviewBubbleTitle, { color: '#2563EB' }]}>Serviço finalizado pelo prestador</Text>
                </View>
                <Text style={styles.reviewBubbleSub}>
                  Confirme que o serviço foi concluído para liberar a avaliação.
                </Text>
                <TouchableOpacity
                  style={[styles.reviewSubmitBtn, confirmSubmitting && styles.reviewSubmitBtnDisabled]}
                  onPress={handleConfirmDone}
                  disabled={confirmSubmitting}
                >
                  {confirmSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.reviewSubmitText}>Confirmar Conclusão</Text>}
                </TouchableOpacity>
              </View>
            );
          }

          if (item.type === 'review_request') {
            return (
              <View style={styles.reviewBubble}>
                <View style={styles.reviewBubbleHeader}>
                  <CheckCircle size={18} color="#16A34A" />
                  <Text style={styles.reviewBubbleTitle}>Serviço concluído!</Text>
                </View>
                <Text style={styles.reviewBubbleSub}>Como foi a experiência com {headerName}?</Text>

                <StarPicker value={reviewRating} onChange={setReviewRating} />

                <TextInput
                  style={styles.reviewCommentInput}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Deixe um comentário (opcional)..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={300}
                />

                <TouchableOpacity
                  style={[styles.reviewSubmitBtn, (reviewRating === 0 || reviewSubmitting) && styles.reviewSubmitBtnDisabled]}
                  onPress={handleSubmitReview}
                  disabled={reviewRating === 0 || reviewSubmitting}
                >
                  {reviewSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.reviewSubmitText}>Enviar Avaliação</Text>}
                </TouchableOpacity>
              </View>
            );
          }

          const outgoing = item.data.direction === 'outgoing';
          const isRead = !!item.data.readAt;
          return (
            <View style={[styles.messageRow, outgoing ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
              <View style={[styles.messageBubble, outgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
                <Text style={[styles.messageText, outgoing ? styles.textOutgoing : styles.textIncoming]}>{item.data.text}</Text>
                <View style={styles.messageMetaRow}>
                  <Text style={[styles.messageTime, outgoing ? styles.timeOutgoing : styles.timeIncoming]}>{formatTime(item.data.createdAt)}</Text>
                  {outgoing && (
                    <View style={styles.receiptContainer} accessibilityLabel={isRead ? 'Mensagem lida' : 'Mensagem enviada'}>
                      {isRead ? (
                        <View style={styles.receiptInner}>
                          <CheckCheck size={12} color="#BAE6FD" />
                          <Text style={styles.receiptTextRead}>Lida</Text>
                        </View>
                      ) : (
                        <View style={styles.receiptInner}>
                          <Check size={12} color="rgba(255,255,255,0.75)" />
                          <Text style={styles.receiptTextSent}>Enviada</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
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
            placeholder={inputPlaceholder(thread.status, thread.canSend)}
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
  },
  timeIncoming: {
    color: '#94A3B8',
  },
  timeOutgoing: {
    color: 'rgba(255,255,255,0.75)',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  receiptContainer: {
    marginLeft: 2,
  },
  receiptInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  receiptTextSent: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
  receiptTextRead: {
    fontSize: 10,
    fontWeight: '600',
    color: '#BAE6FD',
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
  // Review bubble
  reviewBubble: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  reviewBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reviewBubbleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16A34A',
  },
  reviewBubbleSub: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 14,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  reviewCommentInput: {
    minHeight: 70,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  reviewSubmitBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewSubmitBtnDisabled: {
    opacity: 0.45,
  },
  reviewSubmitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  supportBtn: {
    backgroundColor: Colors.light.primary,
  },
});
