import { MapPickerModal } from '@/components/modals/MapPickerModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GlassView } from '@/components/ui/GlassView';
import { Colors, Layout } from '@/constants/Colors';
import { useLocation } from '@/context/LocationContext';
import { useRequest } from '@/context/RequestContext';
import { fetchAddressFromCEP, formatCEP, getSavedAddresses, SavedAddress } from '@/services/cepService';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, CreditCard, MapPin, User, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function RequestDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const category = params.category as string;
    const mode = (params.mode as string) || 'instant';

    // Hook into global context
    const {
        updateDraft,
        submitRequest,
        startDraft,
        category: globalCategory,
        description: globalDesc,
        currentTicket: ticket,
        funnelAnswers,
        questionsHistory,
        aiResult,
        finalConfidence
    } = useRequest();
    const { selectedLocation: liveLoc } = useLocation();

    // The current selection from the map or a previous draft
    // We prioritize liveLoc because it's what's currently "on the map"
    const activeLoc = ticket?.address ? ticket : liveLoc;

    const [description, setDescription] = useState(globalDesc || '');

    // Enhanced Address Form State
    const [cep, setCep] = useState('');
    const [loadingCEP, setLoadingCEP] = useState(false);
    // Address UI State
    const [isSavedAddressesOpen, setIsSavedAddressesOpen] = useState(false);
    const [cepValidated, setCepValidated] = useState(false);
    const [autoStreet, setAutoStreet] = useState('');
    const [autoNeighborhood, setAutoNeighborhood] = useState('');
    const [autoCity, setAutoCity] = useState('');
    const [autoState, setAutoState] = useState('');

    const [streetNumber, setStreetNumber] = useState(activeLoc?.streetNumber || '');
    const [complement, setComplement] = useState('');
    const [reference, setReference] = useState('');
    const [shouldSaveAddress, setShouldSaveAddress] = useState(false);
    const [addressLabel, setAddressLabel] = useState('🏠 Casa');

    // Saved addresses
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [selectedSavedAddress, setSelectedSavedAddress] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false); // TODO: Connect to Supabase Auth

    const [isUrgent, setIsUrgent] = useState(mode === 'instant');
    const [showConfirm, setShowConfirm] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [selectedMapAddress, setSelectedMapAddress] = useState<string | null>(null);

    // Map selection handler
    const handleMapConfirm = (location: {
        lat: number;
        lng: number;
        address: string;
        street?: string;
        number?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    }) => {
        setCepValidated(true); // Trust the map selection

        // Use structured data if available, fall back to parsing or raw address
        if (location.street) setAutoStreet(location.street);
        if (location.neighborhood) setAutoNeighborhood(location.neighborhood);
        if (location.city) setAutoCity(location.city);
        if (location.state) setAutoState(location.state);

        if (location.number) setStreetNumber(location.number);
        else setStreetNumber(''); // Reset if no number found, user must enter

        // Store the full address label for the button
        setSelectedMapAddress(location.address);

        // If we didn't get structured data (old fallback logic just in case)
        if (!location.street && !location.city) {
            // Try to parse components manually as fallback
            const parts = location.address.split(',');
            if (parts.length > 0) setAutoStreet(parts[0].trim());
        }

        setReference('');
    };

    // Load saved addresses (mock for now, will connect to Supabase Auth)
    React.useEffect(() => {
        // ... existing load
    }, []);

    // ...

    {/* 2. ACTIONS ROW */ }
    <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: selectedMapAddress ? Colors.light.primary : '#fff',
                borderWidth: 1,
                borderColor: Colors.light.primary,
                borderRadius: 12,
                borderStyle: selectedMapAddress ? 'solid' : 'dashed'
            }}
            onPress={() => setShowMapPicker(true)}
        >
            <MapPin size={20} color={selectedMapAddress ? '#fff' : Colors.light.primary} style={{ marginRight: 8 }} />
            <Text style={{
                color: selectedMapAddress ? '#fff' : Colors.light.primary,
                fontWeight: '600',
                fontSize: 15,
                textAlign: 'center'
            }} numberOfLines={1}>
                {selectedMapAddress ? selectedMapAddress : 'Escolher local no mapa'}
            </Text>
            {selectedMapAddress && (
                <View style={{ marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>ALTERAR</Text>
                </View>
            )}
        </TouchableOpacity>
    </View>

    // Load saved addresses (mock for now, will connect to Supabase Auth)
    React.useEffect(() => {
        if (isLoggedIn) {
            getSavedAddresses().then(addresses => setSavedAddresses(addresses));
        }
    }, [isLoggedIn]);

    // CEP Auto-complete logic
    const handleCEPBlur = async () => {
        if (cep.length === 9) { // Format: XXXXX-XXX
            setLoadingCEP(true);
            const data = await fetchAddressFromCEP(cep);
            if (data) {
                setAutoStreet(data.logradouro);
                setAutoNeighborhood(data.bairro);
                setAutoCity(data.localidade);
                setAutoState(data.uf);
                setCepValidated(true);
            } else {
                Alert.alert('CEP inválido', 'Não encontramos este CEP. Verifique e tente novamente.');
            }
            setLoadingCEP(false);
        }
    };

    // Auto-init draft if coming directly from another screen (e.g. Provider Profile)
    React.useEffect(() => {
        if (category && globalCategory !== category) {
            startDraft(category, mode as any);
        }
    }, [category, mode, globalCategory]);

    // Reactive update: when hydrated ticket or location data becomes available
    React.useEffect(() => {
        if (ticket?.streetNumber && !streetNumber) setStreetNumber(ticket.streetNumber);
        if (ticket?.complement && !complement) setComplement(ticket.complement);
        if (ticket?.reference && !reference) setReference(ticket.reference);
        if (globalDesc && !description) setDescription(globalDesc);
    }, [ticket, globalDesc, activeLoc]);


    // Auth and Gate State
    const { isGuest } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const handleNext = () => {
        // Validation
        if (!description.trim()) return;
        if (!streetNumber.trim()) {
            Alert.alert('Número obrigatório', 'Por favor, informe o número do endereço.');
            return;
        }
        // CEP is optional now, validation is looser if we have street/city
        if (!autoStreet && !autoCity) {
            Alert.alert('Endereço incompleto', 'Por favor, informe o endereço ou escolha no mapa.');
            return;
        }

        // Sync local to global
        updateDraft(description, undefined, {
            streetNumber,
            complement,
            neighborhood: autoNeighborhood,
            city: autoCity,
            reference
        });

        if (mode === 'instant') {
            setShowConfirm(true);
        } else {
            // For evaluation/workshop, gate with Auth
            if (isGuest) {
                setShowAuthModal(true);
            } else {
                submitRequest();
                router.push({
                    pathname: '/request/new/select-provider',
                });
            }
        }
    };

    const proceedToMatch = () => {
        // Gate checking for 'instant' mode too
        if (isGuest) {
            setShowAuthModal(true);
        } else {
            performSubmission();
        }
    };

    const performSubmission = () => {
        setShowConfirm(false);
        submitRequest(); // Global state -> searching
        router.push({
            pathname: '/request/new/match',
        });
    };

    const handleAuthSuccess = () => {
        setShowAuthModal(false);
        // Decide where to go based on mode
        if (mode === 'instant') {
            performSubmission();
        } else {
            submitRequest();
            router.push({
                pathname: '/request/new/select-provider',
            });
        }
    };


    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

    const handleRedo = () => {
        Alert.alert(
            "Refazer Diagnóstico",
            "Deseja responder as perguntas novamente?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sim, Refazer",
                    style: 'destructive',
                    onPress: () => {
                        // Reset and go back to form
                        resetFunnel();
                        router.back();
                    }
                }
            ]
        );
    };

    const renderSummaryCard = () => (
        <View>
            <Card style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <Text style={styles.summaryTitle}>Resumo do Pedido</Text>
                    {isSummaryExpanded && (
                        <TouchableOpacity onPress={handleRedo}>
                            <Text style={[styles.editLink, { color: '#FF3B30' }]}>Refazer</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.summarySection}>
                    <Text style={styles.summaryLabel}>Categoria: <Text style={styles.summaryValue}>{category}</Text></Text>
                </View>

                {!isSummaryExpanded ? (
                    <>
                        {/* COLLAPSED STATE: Show AI Summary Only */}
                        {aiResult && (
                            <>
                                <View style={styles.divider} />
                                <View style={[styles.summarySection, { backgroundColor: '#f9f9fa', padding: 12, borderRadius: 8, marginTop: 10 }]}>
                                    <Text style={[styles.summaryLabel, { fontSize: 13, marginBottom: 4 }]}>Análise Inteligente:</Text>
                                    <Text style={[styles.summaryValue, { color: Colors.light.primary, fontSize: 16, fontWeight: '700' }]}>
                                        {aiResult.problem_guess || "Problema identificado"}
                                    </Text>
                                    <Text style={[styles.summaryValue, { fontSize: 14, fontWeight: '400', marginTop: 6, color: '#666' }]}>
                                        {aiResult.summary_for_provider}
                                    </Text>
                                </View>

                                {/* Confidence Score */}
                                {aiResult.confidence != null && (
                                    <View style={[styles.summarySection, { marginTop: 8, backgroundColor: aiResult.confidence >= 0.7 ? '#e8f5e9' : '#fff3e0', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                                        <Text style={[styles.summaryLabel, { marginBottom: 0, fontSize: 13 }]}>Confiança da IA:</Text>
                                        <Text style={[styles.summaryValue, { color: aiResult.confidence >= 0.7 ? '#2e7d32' : '#f57c00', fontSize: 18, fontWeight: '700' }]}>
                                            {Math.round(aiResult.confidence * 100)}%
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}

                        <TouchableOpacity
                            style={{ marginTop: 16, paddingVertical: 12, alignItems: 'center' }}
                            onPress={() => setIsSummaryExpanded(true)}
                        >
                            <Text style={{ color: Colors.light.primary, fontSize: 15, fontWeight: '600' }}>
                                Ver detalhes do diagnóstico ▾
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        {/* EXPANDED STATE: Show Q&A History */}
                        <View style={styles.divider} />

                        <View style={styles.summarySection}>
                            <Text style={[styles.summaryLabel, { marginBottom: 10 }]}>Diagnóstico Inicial:</Text>
                            {questionsHistory.map(q => {
                                const answerValue = funnelAnswers[q.id];
                                if (!answerValue) return null;

                                let displayText = answerValue;
                                if (q.type === 'boolean') {
                                    displayText = answerValue === 'true' ? 'Sim' : 'Não';
                                } else if (q.type === 'select' && q.options) {
                                    const opt = q.options.find(o => o.value === answerValue);
                                    if (opt) displayText = opt.label;
                                }
                                return (
                                    <View key={q.id} style={styles.bulletRow}>
                                        <View style={styles.bullet} />
                                        <Text style={styles.bulletText}>{q.text}: <Text style={styles.bulletValue}>{displayText}</Text></Text>
                                    </View>
                                );
                            })}
                        </View>

                        {aiResult && (
                            <>
                                <View style={styles.divider} />
                                <View style={[styles.summarySection, { backgroundColor: '#f9f9fa', padding: 12, borderRadius: 8 }]}>
                                    <Text style={styles.summaryLabel}>Análise Inteligente:</Text>
                                    <Text style={[styles.summaryValue, { color: Colors.light.primary, fontSize: 16, fontWeight: '700' }]}>
                                        {aiResult.problem_guess || "Problema não identificado"}
                                    </Text>
                                    <Text style={[styles.summaryValue, { fontSize: 14, fontWeight: '400', marginTop: 5, color: '#666' }]}>
                                        {aiResult.summary_for_provider}
                                    </Text>
                                </View>

                                {/* Confidence Score */}
                                {aiResult.confidence != null && (
                                    <View style={[styles.summarySection, { marginTop: 8, backgroundColor: aiResult.confidence >= 0.7 ? '#e8f5e9' : '#fff3e0', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                                        <Text style={[styles.summaryLabel, { marginBottom: 0 }]}>Confiança da IA:</Text>
                                        <Text style={[styles.summaryValue, { color: aiResult.confidence >= 0.7 ? '#2e7d32' : '#f57c00', fontSize: 18, fontWeight: '700' }]}>
                                            {Math.round(aiResult.confidence * 100)}%
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}

                        {description ? (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.summarySection}>
                                    <Text style={styles.summaryLabel}>Detalhes Adicionais:</Text>
                                    <Text style={styles.summaryValue}>"{description}"</Text>
                                </View>
                            </>
                        ) : null}

                        <TouchableOpacity
                            style={{ marginTop: 20, alignSelf: 'center', paddingVertical: 10 }}
                            onPress={() => setIsSummaryExpanded(false)}
                        >
                            <Text style={{ color: '#999', fontSize: 14 }}>Ocultar resumo ▴</Text>
                        </TouchableOpacity>
                    </>
                )}
            </Card>
        </View >
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ fontSize: 24 }}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Confirmar Chamado</Text>
                <View style={{ width: 20 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {renderSummaryCard()}

                {/* Enhanced Apple-Style Address Form - ALWAYS VISIBLE */}
                <Card style={[styles.card, { marginTop: 20 }]}>
                    <Text style={styles.question}>Endereço de Atendimento</Text>

                    {/* 1. SAVED ADDRESSES (DROPDOWN / ACCORDION) */}
                    <View style={{ marginBottom: 20 }}>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                backgroundColor: '#F9F9F9',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: '#E5E5EA',
                            }}
                            onPress={() => setIsSavedAddressesOpen(!isSavedAddressesOpen)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MapPin size={18} color={Colors.light.primary} style={{ marginRight: 10 }} />
                                <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>
                                    {selectedSavedAddress
                                        ? savedAddresses.find(a => a.id === selectedSavedAddress)?.label || 'Endereço Salvo'
                                        : 'Selecionar endereço salvo...'
                                    }
                                </Text>
                            </View>
                            <ChevronRight
                                size={20}
                                color="#999"
                                style={{ transform: [{ rotate: isSavedAddressesOpen ? '90deg' : '0deg' }] }}
                            />
                        </TouchableOpacity>

                        {isSavedAddressesOpen && (
                            <View style={{
                                marginTop: 8,
                                backgroundColor: '#fff',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: '#E5E5EA',
                                overflow: 'hidden'
                            }}>
                                {savedAddresses.length > 0 ? (
                                    savedAddresses.map((addr, index) => (
                                        <TouchableOpacity
                                            key={addr.id}
                                            style={{
                                                padding: 16,
                                                borderBottomWidth: index === savedAddresses.length - 1 ? 0 : 1,
                                                borderBottomColor: '#f0f0f0',
                                                backgroundColor: selectedSavedAddress === addr.id ? 'rgba(52, 199, 89, 0.05)' : '#fff'
                                            }}
                                            onPress={() => {
                                                setSelectedSavedAddress(addr.id);
                                                setCep(addr.cep);
                                                setAutoStreet(addr.street);
                                                setStreetNumber(addr.number);
                                                setComplement(addr.complement || '');
                                                setAutoNeighborhood(addr.neighborhood);
                                                setAutoCity(addr.city);
                                                setAutoState(addr.state);
                                                setReference(addr.reference || '');
                                                setCepValidated(true);
                                                setIsSavedAddressesOpen(false);
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
                                                            {addr.label}
                                                        </Text>
                                                        {addr.isDefault && (
                                                            <View style={{ marginLeft: 8, backgroundColor: '#E5E5EA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                                <Text style={{ fontSize: 10, color: '#666' }}>Padrão</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={{ fontSize: 13, color: '#666' }} numberOfLines={1}>
                                                        {addr.street}, {addr.number} - {addr.neighborhood}
                                                    </Text>
                                                </View>
                                                {selectedSavedAddress === addr.id && <Check size={18} color={Colors.light.primary} />}
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ color: '#999', fontSize: 14 }}>
                                            Salve endereços para vê-los aqui.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* 2. ACTIONS ROW */}
                    <View style={{ marginBottom: 20 }}>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 12,
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: Colors.light.primary,
                                borderRadius: 12,
                                borderStyle: 'dashed'
                            }}
                            onPress={() => setShowMapPicker(true)}
                        >
                            <MapPin size={20} color={Colors.light.primary} style={{ marginRight: 8 }} />
                            <Text style={{ color: Colors.light.primary, fontWeight: '600', fontSize: 15 }}>
                                Escolher local no mapa
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5EA' }} />
                        <Text style={{ marginHorizontal: 10, color: '#999', fontSize: 12 }}>OU PREENCHA</Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5EA' }} />
                    </View>

                    {/* 3. FORM INPUTS (Always Visible) */}
                    <View style={{ gap: 12 }}>
                        {/* CEP Helper - Optional */}
                        <View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={styles.label}>CEP (Opcional)</Text>
                                <TouchableOpacity onPress={() => Linking.openURL('https://buscacepinter.correios.com.br/app/endereco/index.php')}>
                                    <Text style={{ fontSize: 12, color: Colors.light.primary, fontWeight: '500' }}>
                                        Não sei meu CEP ↗
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput
                                    style={[styles.miniInput, { flex: 1, marginBottom: 0 }]}
                                    value={cep}
                                    onChangeText={(text) => {
                                        const formatted = formatCEP(text);
                                        setCep(formatted);
                                        if (formatted.replace(/\D/g, '').length === 8) {
                                            handleCEPBlur(); // Auto-trigger search
                                        }
                                        if (formatted.length < 9) setCepValidated(false);
                                    }}
                                    onBlur={handleCEPBlur}
                                    placeholder="00000-000"
                                    keyboardType="numeric"
                                    maxLength={9}
                                />
                                {loadingCEP && <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginLeft: 8 }} />}
                            </View>
                            <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                                Preencha para buscar endereço automaticamente
                            </Text>
                        </View>

                        <View>
                            <Text style={styles.label}>Logradouro</Text>
                            <TextInput
                                style={styles.miniInput}
                                value={autoStreet}
                                onChangeText={setAutoStreet}
                                placeholder="Rua, Avenida, etc"
                            />
                        </View>

                        <View style={styles.formRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.label}>Número *</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    value={streetNumber}
                                    onChangeText={setStreetNumber}
                                    placeholder="123"
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 2 }}>
                                <Text style={styles.label}>Complemento</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    value={complement}
                                    onChangeText={setComplement}
                                    placeholder="Apto 101"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={{ flex: 3, marginRight: 10 }}>
                                <Text style={styles.label}>Bairro</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    value={autoNeighborhood}
                                    onChangeText={setAutoNeighborhood}
                                    placeholder="Bairro"
                                />
                            </View>
                            <View style={{ flex: 2 }}>
                                <Text style={styles.label}>Cidade</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    value={autoCity}
                                    onChangeText={setAutoCity}
                                    placeholder="Cidade"
                                />
                            </View>
                        </View>

                        <View>
                            <Text style={styles.label}>Ponto de Referência</Text>
                            <TextInput
                                style={styles.miniInput}
                                value={reference}
                                onChangeText={setReference}
                                placeholder="Ex: Próximo ao mercado XYZ"
                            />
                        </View>

                        {/* SAVE CHECKBOX */}
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 5 }}
                            onPress={() => setShouldSaveAddress(!shouldSaveAddress)}
                        >
                            <View style={{
                                width: 20,
                                height: 20,
                                borderWidth: 2,
                                borderColor: Colors.light.primary,
                                borderRadius: 4,
                                marginRight: 10,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: shouldSaveAddress ? Colors.light.primary : '#fff'
                            }}>
                                {shouldSaveAddress && <Check size={14} color="#fff" />}
                            </View>
                            <Text style={{ fontSize: 14, color: '#666' }}>
                                Salvar este endereço
                            </Text>
                        </TouchableOpacity>

                        {shouldSaveAddress && (
                            <View style={{ marginTop: 8 }}>
                                <Text style={styles.label}>Nome do local</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    value={addressLabel}
                                    onChangeText={setAddressLabel}
                                    placeholder="Ex: 🏠 Casa de Praia"
                                />
                            </View>
                        )}
                    </View>
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
                                    {autoNeighborhood}, {autoCity} {complement ? `(${complement})` : ''}
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

            {/* Auth Gate Modal */}
            <AuthBottomSheet
                visible={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />


            <MapPickerModal
                visible={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                onConfirm={handleMapConfirm}
            />
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
    },
    summaryCard: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 24,
        ...Layout.shadows.medium,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    summaryTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.light.text,
    },
    editLink: {
        color: Colors.light.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    summarySection: {
        marginVertical: 4,
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.light.textSecondary,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginVertical: 16,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 6,
        paddingLeft: 4,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.light.primary,
        marginTop: 7,
        marginRight: 10,
    },
    bulletText: {
        flex: 1,
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
    bulletValue: {
        fontWeight: '700',
        color: '#333',
    }
});
