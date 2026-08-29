import { Colors, Layout } from '@/constants/Colors';
import { useProviderChatThread } from '@/hooks/useProviderChatThread';
import { toErrorMessage } from '@/utils/error';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, ShieldCheck } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function statusLabel(status?: string): string {
    if (status === 'accepted' || status === 'confirmed') return 'Pedido confirmado';
    if (status === 'en_route') return 'A caminho';
    if (status === 'arrived') return 'No local';
    if (status === 'quote_provided') return 'Orçamento enviado';
    if (status === 'quote_accepted') return 'Em execução';
    if (status === 'done' || status === 'completed') return 'Concluído';
    if (status === 'canceled') return 'Cancelado';
    return 'Em atendimento';
}

function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ProviderChatRoomScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const requestId = Array.isArray(params.id) ? params.id[0] : params.id;
    const listRef = useRef<FlatList>(null);

    const [inputText, setInputText] = useState('');
    const [composerError, setComposerError] = useState<string | null>(null);

    const { thread, messages, loading, error, sending, sendMessage, refetch } = useProviderChatThread(requestId);

    const icebreakers = useMemo(() => {
        const clientName = thread?.client?.name || 'cliente';
        const category = thread?.category || 'serviço';
        return [
            `Olá, ${clientName}! Recebi seu pedido de ${category}. Pode me contar mais detalhes do problema?`,
            `Oi! Posso te atender hoje. Qual horário funciona melhor para a visita?`,
            'Para agilizar, confirme por favor um ponto de referência do endereço e melhor forma de acesso.',
        ];
    }, [thread?.category, thread?.client?.name]);

    const handleSend = async (textToSend?: string) => {
        const content = (textToSend ?? inputText).trim();
        if (!content) return;

        setComposerError(null);
        try {
            await sendMessage(content);
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
                <View style={styles.centerWrap}>
                    <Text style={styles.centerTitle}>Conversa não encontrada</Text>
                    <Text style={styles.centerSubtitle}>Pedido inválido para abrir o chat.</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
                        <Text style={styles.primaryBtnText}>Voltar</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerWrap}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.centerSubtitle}>Carregando conversa...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !thread) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerWrap}>
                    <Text style={styles.centerTitle}>Erro ao abrir chat</Text>
                    <Text style={styles.centerSubtitle}>{error || 'Conversa não disponível.'}</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => refetch()}>
                        <Text style={styles.primaryBtnText}>Tentar novamente</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={20} color={Colors.light.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{thread.client.name}</Text>
                        <Text style={styles.headerOrderId}>#{requestId.split('-')[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.headerSubtitle}>{statusLabel(thread.status)}</Text>
                </View>
            </View>

            <View style={styles.securityCard}>
                <ShieldCheck size={15} color={Colors.light.success} />
                <Text style={styles.securityText}>
                    Segurança Reparaí: mantenha todo contato aqui no app. Não compartilhe telefone, link ou e-mail.
                </Text>
            </View>

            {messages.length === 0 && (
                <View style={styles.icebreakerCard}>
                    <View style={styles.icebreakerTitleRow}>
                        <MessageCircle size={16} color={Colors.light.primary} />
                        <Text style={styles.icebreakerTitle}>Sugestões de abertura</Text>
                    </View>
                    <Text style={styles.icebreakerSubtitle}>Use um icebreaker para começar rápido e profissional:</Text>
                    <View style={styles.icebreakerChipsWrap}>
                        {icebreakers.map((suggestion) => (
                            <TouchableOpacity
                                key={suggestion}
                                style={styles.icebreakerChip}
                                onPress={() => setInputText(suggestion)}
                            >
                                <Text style={styles.icebreakerChipText} numberOfLines={2}>{suggestion}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.messagesContent, messages.length === 0 && { flexGrow: 0, paddingBottom: 8 }]}
                renderItem={({ item }) => {
                    const outgoing = item.direction === 'outgoing';
                    return (
                        <View style={[styles.msgRow, outgoing ? styles.msgRowOut : styles.msgRowIn]}>
                            <View style={[styles.msgBubble, outgoing ? styles.msgBubbleOut : styles.msgBubbleIn]}>
                                <Text style={[styles.msgText, outgoing ? styles.msgTextOut : styles.msgTextIn]}>
                                    {item.text}
                                </Text>
                                <Text style={[styles.msgTime, outgoing ? styles.msgTimeOut : styles.msgTimeIn]}>
                                    {formatTime(item.createdAt)}
                                </Text>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={null}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                keyboardShouldPersistTaps="handled"
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            >
                {composerError ? (
                    <View style={styles.errorStrip}>
                        <Text style={styles.errorStripText}>{composerError}</Text>
                    </View>
                ) : null}

                <View style={styles.inputRow}>
                    <TextInput
                        value={inputText}
                        onChangeText={setInputText}
                        style={[styles.input, !thread.canSend && styles.inputDisabled]}
                        placeholder={thread.status === 'done' ? 'Atendimento concluído. Chat encerrado.' : (thread.canSend ? 'Digite uma mensagem...' : 'O chat será liberado quando o pedido estiver com você')}
                        placeholderTextColor="#9CA3AF"
                        editable={thread.canSend && !sending}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendBtn,
                            (!thread.canSend || sending || !inputText.trim()) && styles.sendBtnDisabled,
                        ]}
                        onPress={() => handleSend()}
                        disabled={!thread.canSend || sending || !inputText.trim()}
                    >
                        <Text style={styles.sendBtnText}>{sending ? '...' : 'Enviar'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
        paddingHorizontal: Layout.spacing.md,
        paddingVertical: Layout.spacing.sm,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.light.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.light.textMuted,
        marginTop: 2,
    },
    headerOrderId: {
        fontSize: 12,
        fontWeight: '700',
        color: '#9CA3AF',
        marginLeft: 6,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 4,
        borderRadius: 4,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    securityCard: {
        marginHorizontal: Layout.spacing.md,
        marginTop: Layout.spacing.sm,
        marginBottom: 6,
        backgroundColor: Colors.light.successBackground,
        borderRadius: Layout.radius.sm,
        paddingHorizontal: Layout.spacing.sm,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    securityText: {
        flex: 1,
        fontSize: 12,
        color: '#14532D',
        lineHeight: 17,
        fontWeight: '600',
    },
    icebreakerCard: {
        marginHorizontal: Layout.spacing.md,
        marginTop: Layout.spacing.sm,
        marginBottom: Layout.spacing.sm,
        backgroundColor: '#fff',
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Layout.spacing.sm,
    },
    icebreakerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    icebreakerTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: Colors.light.text,
    },
    icebreakerSubtitle: {
        fontSize: 12,
        color: Colors.light.textMuted,
        marginBottom: 8,
    },
    icebreakerChipsWrap: {
        gap: 6,
    },
    icebreakerChip: {
        borderRadius: Layout.radius.sm,
        borderWidth: 1,
        borderColor: Colors.light.primary + '44',
        backgroundColor: Colors.light.primary + '10',
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    icebreakerChipText: {
        fontSize: 12,
        color: Colors.light.text,
        lineHeight: 17,
    },
    messagesContent: {
        paddingHorizontal: Layout.spacing.md,
        paddingBottom: 8,
        paddingTop: 4,
    },
    msgRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    msgRowIn: {
        justifyContent: 'flex-start',
    },
    msgRowOut: {
        justifyContent: 'flex-end',
    },
    msgBubble: {
        maxWidth: '82%',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    msgBubbleIn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.light.border + 'AA',
        borderBottomLeftRadius: 6,
    },
    msgBubbleOut: {
        backgroundColor: Colors.light.primary,
        borderBottomRightRadius: 6,
    },
    msgText: {
        fontSize: 14,
        lineHeight: 20,
    },
    msgTextIn: {
        color: Colors.light.text,
    },
    msgTextOut: {
        color: '#fff',
    },
    msgTime: {
        marginTop: 4,
        fontSize: 11,
        alignSelf: 'flex-end',
    },
    msgTimeIn: {
        color: Colors.light.textMuted,
    },
    msgTimeOut: {
        color: '#ffffffcc',
    },
    inputRow: {
        flexDirection: 'row',
        paddingHorizontal: Layout.spacing.md,
        paddingBottom: Layout.spacing.md,
        paddingTop: 8,
        gap: 8,
        backgroundColor: Colors.light.background,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: Colors.light.text,
    },
    inputDisabled: {
        backgroundColor: '#F3F4F6',
        color: Colors.light.textMuted,
    },
    sendBtn: {
        width: 76,
        borderRadius: 12,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.5,
    },
    sendBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    errorStrip: {
        marginHorizontal: Layout.spacing.md,
        marginBottom: 6,
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderWidth: 1,
        borderRadius: Layout.radius.sm,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    errorStripText: {
        color: '#991B1B',
        fontSize: 12,
        fontWeight: '600',
    },
    centerWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Layout.spacing.xl,
        gap: 10,
    },
    centerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.light.text,
    },
    centerSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        color: Colors.light.textMuted,
        lineHeight: 20,
    },
    primaryBtn: {
        marginTop: 6,
        height: 42,
        borderRadius: 12,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    primaryBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
});
