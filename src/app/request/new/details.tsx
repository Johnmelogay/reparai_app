import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GlassView } from '@/components/ui/GlassView';
import { Colors, Layout } from '@/constants/Colors';
import { useLocation } from '@/context/LocationContext';
import { useRequest } from '@/context/RequestContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Camera, ChevronRight, Clock, CreditCard, MapPin, Mic, User, X, Zap } from 'lucide-react-native';
import React, { useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function RequestDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const category = params.category as string;
    const mode = (params.mode as string) || 'instant';

    // Hook into global context
    const { updateDraft, submitRequest, startDraft, category: globalCategory, description: globalDesc, currentTicket: ticket } = useRequest();
    const { selectedLocation: liveLoc } = useLocation();

    // The current selection from the map or a previous draft
    // We prioritize liveLoc because it's what's currently "on the map"
    const activeLoc = ticket?.address ? ticket : liveLoc;

    const [description, setDescription] = useState(globalDesc || '');
    const [streetNumber, setStreetNumber] = useState(activeLoc?.streetNumber || '');
    const [complement, setComplement] = useState('');
    const [neighborhood, setNeighborhood] = useState(activeLoc?.neighborhood || '');
    const [city, setCity] = useState(activeLoc?.city || '');
    const [reference, setReference] = useState('');

    const [isUrgent, setIsUrgent] = useState(mode === 'instant');
    const [showConfirm, setShowConfirm] = useState(false);

    // Auto-init draft if coming directly from another screen (e.g. Provider Profile)
    React.useEffect(() => {
        if (category && globalCategory !== category) {
            startDraft(category, mode as any);
        }
    }, [category, mode, globalCategory]);

    // Reactive update: when hydrated ticket or location data becomes available
    React.useEffect(() => {
        if (ticket?.streetNumber && !streetNumber) setStreetNumber(ticket.streetNumber);
        if (ticket?.neighborhood && !neighborhood) setNeighborhood(ticket.neighborhood);
        if (ticket?.city && !city) setCity(ticket.city);
        if (ticket?.complement && !complement) setComplement(ticket.complement);
        if (ticket?.reference && !reference) setReference(ticket.reference);
        if (globalDesc && !description) setDescription(globalDesc);
    }, [ticket, globalDesc, activeLoc]);

    const handleNext = () => {
        // Validation
        if (!description.trim()) return;
        if (!streetNumber.trim()) return;
        if (!neighborhood.trim()) return;
        if (!city.trim()) return;

        // Sync local to global
        updateDraft(description, undefined, {
            streetNumber,
            complement,
            neighborhood,
            city,
            reference
        });

        if (mode === 'instant') {
            setShowConfirm(true);
        } else {
            // For evaluation/workshop, go to provider selection first
            submitRequest();
            router.push({
                pathname: '/request/new/select-provider',
            });
        }
    };

    const proceedToMatch = () => {
        setShowConfirm(false);
        submitRequest(); // Global state -> searching
        router.push({
            pathname: '/request/new/match',
        });
    };

    const renderFastMode = () => (
        <View>
            <View style={styles.bannerFast}>
                <Zap size={24} color="#fff" />
                <Text style={styles.bannerText}>Modo Rápido: Chegada em até 1h</Text>
            </View>

            <Card style={styles.card}>
                <Text style={styles.question}>O que está acontecendo?</Text>
                <Text style={styles.hint}>Descreva o problema para que possamos ajudar rapidamente</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ex: Pneu furado, Vazamento urgente, Aparelho não liga..."
                    placeholderTextColor="#999"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                />
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                        <Camera size={20} color={Colors.light.primary} />
                        <Text style={styles.actionBtnText}>Adicionar Foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                        <Mic size={20} color={Colors.light.primary} />
                        <Text style={styles.actionBtnText}>Gravar Áudio</Text>
                    </TouchableOpacity>
                </View>
            </Card>
        </View>
    );

    const renderEvalMode = () => (
        <View>
            <View style={styles.bannerEval}>
                <Clock size={24} color="#5B21B6" />
                <Text style={[styles.bannerText, { color: '#5B21B6' }]}>Orçamento: Aberto por 48h</Text>
            </View>

            <Card style={styles.card}>
                <Text style={styles.question}>Descreva o que precisa</Text>
                <Text style={styles.subHint}>Detalhe bem para receber propostas precisas.</Text>
                <TextInput
                    style={[styles.input, { height: 120 }]}
                    placeholder="Ex: Preciso instalar 3 ar condicionados split no centro..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={5}
                />
            </Card>

            <Card style={[styles.card, { marginTop: 15 }]}>
                <Text style={styles.question}>Melhor horário para visita</Text>
                <View style={styles.dateRow}>
                    <Calendar size={20} color="#666" />
                    <Text style={{ marginLeft: 10, color: '#333' }}>Qualquer dia, horário comercial</Text>
                </View>
            </Card>
        </View>
    );

    const renderShopMode = () => (
        <View>
            <View style={styles.bannerShop}>
                <MapPin size={24} color="#1E40AF" />
                <Text style={[styles.bannerText, { color: '#1E40AF' }]}>Leva e Traz / Oficina</Text>
            </View>

            <View style={styles.mapPlaceholder}>
                <MapPin size={40} color={Colors.light.primary} />
                <Text style={styles.mapText}>Mapa de Oficinas Próximas</Text>
                <Text style={styles.mapSubtext}>Selecione uma loja no mapa (Mock)</Text>
            </View>

            <Card style={styles.card}>
                <Text style={styles.question}>Agendar Visita</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Qual o problema do item?"
                    value={description}
                    onChangeText={setDescription}
                />
            </Card>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ fontSize: 24 }}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detalhes do Chamado</Text>
                <View style={{ width: 20 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.categoryTitle}>{category || 'Solicitação'}</Text>

                {mode === 'instant' && renderFastMode()}
                {mode === 'evaluation' && renderEvalMode()}
                {mode === 'workshop' && renderShopMode()}

                {/* Detailed Address Form */}
                <Card style={[styles.card, { marginTop: 20 }]}>
                    <Text style={styles.question}>Endereço de Atendimento</Text>
                    <Text style={styles.hint}>Confirme o local exato para o profissional</Text>

                    <View style={styles.lockedAddress}>
                        <MapPin size={16} color="#666" />
                        <Text style={styles.lockedAddressText} numberOfLines={1}>
                            {activeLoc?.address || 'Enderço não selecionado'}
                        </Text>
                    </View>

                    <View style={styles.formRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Número *</Text>
                            <TextInput
                                style={styles.miniInput}
                                value={streetNumber}
                                onChangeText={setStreetNumber}
                                placeholder="Ex: 123"
                                keyboardType="default"
                            />
                        </View>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.label}>Complemento</Text>
                            <TextInput
                                style={styles.miniInput}
                                value={complement}
                                onChangeText={setComplement}
                                placeholder="Ex: Apto 01 / Fundos"
                            />
                        </View>
                    </View>

                    <View style={styles.formRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Bairro *</Text>
                            <TextInput
                                style={styles.miniInput}
                                value={neighborhood}
                                onChangeText={setNeighborhood}
                                placeholder="Bairro"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Cidade *</Text>
                            <TextInput
                                style={styles.miniInput}
                                value={city}
                                onChangeText={setCity}
                                placeholder="Cidade"
                            />
                        </View>
                    </View>

                    <Text style={styles.label}>Ponto de Referência</Text>
                    <TextInput
                        style={styles.miniInput}
                        value={reference}
                        onChangeText={setReference}
                        placeholder="Ex: Próximo ao mercado..."
                    />
                </Card>

                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    title={mode === 'instant' ? "Chamar Agora" : mode === 'workshop' ? "Agendar Visita" : "Publicar Pedido"}
                    onPress={handleNext}
                    disabled={mode !== 'workshop' && !description}
                />
            </View>

            {/* Confirmation Sheet Overlay */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showConfirm}
                onRequestClose={() => setShowConfirm(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        onPress={() => setShowConfirm(false)}
                        activeOpacity={1}
                    />

                    <GlassView intensity={40} style={styles.confirmSheet}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Confirmar Detalhes</Text>
                            <TouchableOpacity onPress={() => setShowConfirm(false)}>
                                <X size={24} color="#555" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sheetSub}>Confirme seus dados para agilizar o atendimento.</Text>

                        <View style={styles.infoRow}>
                            <View style={styles.iconCircle}>
                                <User size={20} color={Colors.light.primary} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Solicitante</Text>
                                <Text style={styles.infoValue}>João Melo</Text>
                            </View>
                            <ChevronRight size={20} color="#ccc" />
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.iconCircle}>
                                <MapPin size={20} color={Colors.light.primary} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Endereço</Text>
                                <Text style={styles.infoValue} numberOfLines={1}>
                                    {activeLoc?.address?.split('-')[0].trim() || 'Av. Carlos Gomes'}, {streetNumber}
                                </Text>
                                <Text style={styles.infoSubValue}>
                                    {neighborhood}, {city} {complement ? `(${complement})` : ''}
                                </Text>
                            </View>
                            <ChevronRight size={20} color="#ccc" />
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.iconCircle}>
                                <CreditCard size={20} color={Colors.light.primary} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Pagamento</Text>
                                <Text style={styles.infoValue}>Cartão •••• 4242</Text>
                            </View>
                            <ChevronRight size={20} color="#ccc" />
                        </View>

                        <Button
                            title="Confirmar e Chamar"
                            onPress={proceedToMatch}
                            style={{ marginTop: 20, backgroundColor: Colors.light.success }}
                        />
                    </GlassView>
                </View>
            </Modal>
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
    },
    categoryTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: Layout.spacing.lg,
    },
    card: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
    },
    question: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
        color: '#333',
    },
    hint: {
        fontSize: 13,
        color: '#666',
        marginBottom: 12,
        lineHeight: 18,
    },
    subHint: {
        fontSize: 12,
        color: '#666',
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E5EA',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        backgroundColor: '#FAFAFA',
        minHeight: 100,
        textAlignVertical: 'top',
        color: '#333',
    },
    bannerFast: {
        backgroundColor: Colors.light.success,
        padding: 15,
        borderRadius: Layout.radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Layout.spacing.lg,
    },
    bannerEval: {
        backgroundColor: '#EDE9FE',
        padding: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    bannerShop: {
        backgroundColor: '#DBEAFE',
        padding: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    bannerText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 10,
        fontSize: 16,
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 15,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 10,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
    actionBtnText: {
        marginLeft: 8,
        fontWeight: '600',
        color: Colors.light.primary,
        fontSize: 14,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    mapPlaceholder: {
        height: 150,
        backgroundColor: Colors.light.background,
        borderRadius: Layout.radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Layout.spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    mapText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.primary,
        marginTop: 10,
    },
    mapSubtext: {
        color: Colors.light.textSecondary,
        fontSize: 12,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    confirmSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        // Fallback for no glass support
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#ddd',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sheetTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    sheetSub: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff4e6', // light orange tint
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#888',
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    infoSubValue: {
        fontSize: 13,
        color: '#666',
    },
    lockedAddress: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
    lockedAddressText: {
        marginLeft: 10,
        color: '#666',
        fontSize: 14,
        flex: 1,
    },
    formRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#444',
        marginBottom: 5,
        marginLeft: 4,
    },
    miniInput: {
        backgroundColor: Colors.light.background,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        borderRadius: Layout.radius.md,
        padding: 12,
        fontSize: 15,
        color: Colors.light.text,
        marginBottom: 10,
    }
});
