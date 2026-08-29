import { Colors, Layout } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { PartnerHighlight } from '@/types';
import { compressAndUpload } from '@/utils/imageUpload';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    Camera,
    GripVertical,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type HighlightDraft = {
    id?: string;
    name: string;
    description: string;
    price: string;
    original_price: string;
    image_url: string | null;
};

const EMPTY_DRAFT: HighlightDraft = {
    name: '',
    description: '',
    price: '',
    original_price: '',
    image_url: null,
};

export default function HighlightsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [modalVisible, setModalVisible] = useState(false);
    const [draft, setDraft] = useState<HighlightDraft>(EMPTY_DRAFT);
    const [uploading, setUploading] = useState(false);

    // Fetch highlights
    const { data: highlights = [], isLoading } = useQuery<PartnerHighlight[]>({
        queryKey: ['partner_highlights', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('partner_highlights')
                .select('*')
                .eq('partner_id', user.id)
                .order('sort_order', { ascending: true });
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!user,
    });

    // Save (insert or update)
    const saveMutation = useMutation({
        mutationFn: async (item: HighlightDraft) => {
            if (!user) throw new Error('Not authenticated');

            const parsedPrice = Number(item.price.replace(',', '.'));
            if (!item.name.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
                throw new Error('Nome e preço válido são obrigatórios.');
            }

            const parsedOriginal = item.original_price.trim()
                ? Number(item.original_price.replace(',', '.'))
                : null;

            const payload = {
                partner_id: user.id,
                name: item.name.trim(),
                description: item.description.trim() || null,
                price: parsedPrice,
                original_price: parsedOriginal,
                image_url: item.image_url,
                is_active: true,
            };

            if (item.id) {
                const { error } = await supabase
                    .from('partner_highlights')
                    .update(payload)
                    .eq('id', item.id);
                if (error) throw error;
            } else {
                const nextOrder = highlights.length;
                const { error } = await supabase
                    .from('partner_highlights')
                    .insert({ ...payload, sort_order: nextOrder });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner_highlights', user?.id] });
            setModalVisible(false);
            setDraft(EMPTY_DRAFT);
        },
        onError: (err: any) => {
            Alert.alert('Erro', err?.message || 'Não foi possível salvar o destaque.');
        },
    });

    // Delete
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('partner_highlights')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner_highlights', user?.id] });
        },
        onError: (err: any) => {
            Alert.alert('Erro', err?.message || 'Não foi possível excluir o destaque.');
        },
    });

    const handleDelete = (item: PartnerHighlight) => {
        Alert.alert('Excluir destaque', `Tem certeza que deseja excluir "${item.name}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
        ]);
    };

    const handleEdit = (item: PartnerHighlight) => {
        setDraft({
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: String(item.price),
            original_price: item.original_price != null ? String(item.original_price) : '',
            image_url: item.image_url,
        });
        setModalVisible(true);
    };

    const handleNew = () => {
        setDraft(EMPTY_DRAFT);
        setModalVisible(true);
    };

    const handlePickImage = async () => {
        if (!user) return;

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permissão necessária', 'Permita acesso às fotos para adicionar imagem.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1, // raw — compression handled by compressAndUpload
        });

        if (result.canceled || !result.assets?.[0]) return;

        try {
            setUploading(true);
            const publicUrl = await compressAndUpload({
                uri: result.assets[0].uri,
                bucket: 'highlight-images',
                path: `${user.id}/highlight-${Date.now()}.jpg`,
                maxWidth: 800,
                quality: 0.7,
            });
            setDraft((prev) => ({ ...prev, image_url: publicUrl }));
        } catch (error: any) {
            Alert.alert('Erro ao enviar imagem', error?.message || 'Tente novamente.');
        } finally {
            setUploading(false);
        }
    };

    const formatPrice = (value: number) => {
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
    };

    const renderHighlight = ({ item }: { item: PartnerHighlight }) => (
        <View style={styles.highlightCard}>
            <View style={styles.highlightRow}>
                <GripVertical size={18} color={Colors.light.textMuted} />
                {item.image_url ? (
                    <ExpoImage source={{ uri: item.image_url }} style={styles.thumbImage} contentFit="cover" />
                ) : (
                    <View style={styles.thumbPlaceholder}>
                        <Camera size={18} color={Colors.light.textMuted} />
                    </View>
                )}
                <View style={styles.highlightInfo}>
                    <Text style={styles.highlightName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.priceRow}>
                        {item.original_price != null && (
                            <Text style={styles.originalPrice}>{formatPrice(item.original_price)}</Text>
                        )}
                        <Text style={styles.currentPrice}>{formatPrice(item.price)}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(item)}>
                    <Pencil size={16} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
                    <Trash2 size={16} color={Colors.light.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={20} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Meus Destaques</Text>
                <TouchableOpacity onPress={handleNew} style={styles.addHeaderBtn}>
                    <Plus size={20} color={Colors.light.primary} />
                </TouchableOpacity>
            </View>

            {highlights.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>Nenhum destaque ainda</Text>
                    <Text style={styles.emptySubtitle}>
                        Adicione seus serviços e promoções para atrair mais clientes.
                    </Text>
                    <TouchableOpacity style={styles.emptyButton} onPress={handleNew}>
                        <Plus size={18} color="#fff" />
                        <Text style={styles.emptyButtonText}>Criar Destaque</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={highlights}
                    keyExtractor={(item) => item.id}
                    renderItem={renderHighlight}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Add/Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer} edges={['top']}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => { setModalVisible(false); setDraft(EMPTY_DRAFT); }}>
                            <X size={22} color={Colors.light.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>{draft.id ? 'Editar Destaque' : 'Novo Destaque'}</Text>
                        <View style={{ width: 22 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View>
                                {/* Image */}
                                <TouchableOpacity style={styles.imagePickerArea} onPress={handlePickImage} disabled={uploading}>
                                    {uploading ? (
                                        <ActivityIndicator color={Colors.light.primary} />
                                    ) : draft.image_url ? (
                                        <ExpoImage source={{ uri: draft.image_url }} style={styles.imagePreview} contentFit="cover" />
                                    ) : (
                                        <View style={styles.imagePickerPlaceholder}>
                                            <Camera size={28} color={Colors.light.textMuted} />
                                            <Text style={styles.imagePickerText}>Adicionar Imagem</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Name */}
                                <Text style={styles.label}>Nome do serviço *</Text>
                                <TextInput
                                    value={draft.name}
                                    onChangeText={(t) => setDraft((p) => ({ ...p, name: t }))}
                                    style={styles.input}
                                    placeholder="Ex: Troca de tela iPhone"
                                    placeholderTextColor={Colors.light.textMuted}
                                />

                                {/* Description */}
                                <Text style={styles.label}>Descrição</Text>
                                <TextInput
                                    value={draft.description}
                                    onChangeText={(t) => setDraft((p) => ({ ...p, description: t }))}
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Detalhes sobre o serviço..."
                                    placeholderTextColor={Colors.light.textMuted}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />

                                {/* Price */}
                                <Text style={styles.label}>Preço (R$) *</Text>
                                <TextInput
                                    value={draft.price}
                                    onChangeText={(t) => setDraft((p) => ({ ...p, price: t }))}
                                    style={styles.input}
                                    placeholder="Ex: 150"
                                    placeholderTextColor={Colors.light.textMuted}
                                    keyboardType="decimal-pad"
                                />

                                {/* Original Price */}
                                <Text style={styles.label}>Preço original (opcional — riscado)</Text>
                                <TextInput
                                    value={draft.original_price}
                                    onChangeText={(t) => setDraft((p) => ({ ...p, original_price: t }))}
                                    style={styles.input}
                                    placeholder="Ex: 200"
                                    placeholderTextColor={Colors.light.textMuted}
                                    keyboardType="decimal-pad"
                                />

                                {/* Save */}
                                <TouchableOpacity
                                    style={[styles.saveButton, saveMutation.isPending && styles.saveButtonDisabled]}
                                    onPress={() => saveMutation.mutate(draft)}
                                    disabled={saveMutation.isPending}
                                >
                                    {saveMutation.isPending ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>
                                            {draft.id ? 'Salvar Alterações' : 'Criar Destaque'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Layout.spacing.md,
        backgroundColor: Colors.light.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.light.text,
    },
    addHeaderBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary + '15',
    },
    listContent: {
        padding: Layout.spacing.md,
        gap: Layout.spacing.sm,
        paddingBottom: 40,
    },
    highlightCard: {
        backgroundColor: Colors.light.card,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
        ...Layout.shadows.small,
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Layout.spacing.sm,
    },
    thumbImage: {
        width: 52,
        height: 52,
        borderRadius: Layout.radius.md,
    },
    thumbPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    highlightInfo: {
        flex: 1,
    },
    highlightName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.text,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    originalPrice: {
        fontSize: 13,
        color: Colors.light.textMuted,
        textDecorationLine: 'line-through',
    },
    currentPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.light.primary,
    },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
    },
    // Empty state
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Layout.spacing.xl,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: Layout.spacing.xs,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginBottom: Layout.spacing.lg,
    },
    emptyButton: {
        height: 46,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.primary,
        paddingHorizontal: Layout.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    emptyButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    modalHeader: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Layout.spacing.md,
        backgroundColor: Colors.light.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.light.text,
    },
    modalContent: {
        padding: Layout.spacing.md,
        gap: Layout.spacing.xs,
        paddingBottom: 40,
    },
    imagePickerArea: {
        width: '100%',
        height: 180,
        borderRadius: Layout.radius.lg,
        overflow: 'hidden',
        backgroundColor: Colors.light.card,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderStyle: 'dashed',
        marginBottom: Layout.spacing.md,
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    imagePickerPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    imagePickerText: {
        fontSize: 14,
        color: Colors.light.textMuted,
    },
    label: {
        fontSize: 13,
        color: Colors.light.textMuted,
        marginBottom: 6,
        marginTop: Layout.spacing.sm,
    },
    input: {
        height: 46,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: '#fff',
        paddingHorizontal: Layout.spacing.md,
        color: Colors.light.text,
        fontSize: 15,
    },
    textArea: {
        height: 90,
        paddingTop: Layout.spacing.sm,
    },
    saveButton: {
        height: 52,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Layout.spacing.lg,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
});
