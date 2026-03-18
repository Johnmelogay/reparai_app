import { GooglePlacesInput } from '@/components/GooglePlacesInput';
import { AuthBottomSheet } from '@/components/modals/AuthBottomSheet';
import { MapPickerModal } from '@/components/modals/MapPickerModal';
import SavedAddressesList from '@/components/SavedAddressesList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, Layout } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import { useRequest } from '@/context/RequestContext';
import { useGooglePlaces } from '@/hooks/useGooglePlaces';
import { fetchAddressFromCEP, formatCEP } from '@/services/cepService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, MapPin } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        resetFunnel
    } = useRequest();
    const { selectedLocation: liveLoc, saveAddress, selectLocation } = useLocation();

    // The current selection from the map or a previous draft
    // We prioritize liveLoc because it's what's currently "on the map"
    const activeLoc = liveLoc || ticket;

    const [description, setDescription] = useState(globalDesc || '');

    // Enhanced Address Form State
    const [cep, setCep] = useState('');
    const [loadingCEP, setLoadingCEP] = useState(false);
    // Address UI State
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
    const [isManualEntryExpanded, setIsManualEntryExpanded] = useState(false);



    const [showAddressOptions, setShowAddressOptions] = useState(!activeLoc?.address);
    const [showMapPicker, setShowMapPicker] = useState(false);

    const { getPlaceDetails } = useGooglePlaces();

    const applyLocationToDraft = (payload: {
        lat: number;
        lng: number;
        address: string;
        streetNumber?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    }) => {
        selectLocation(payload.lat, payload.lng, payload.address, {
            streetNumber: payload.streetNumber,
            neighborhood: payload.neighborhood,
            city: payload.city,
            state: payload.state,
        });

        updateDraft(description, undefined, {
            address: payload.address,
            streetNumber: payload.streetNumber,
            neighborhood: payload.neighborhood,
            city: payload.city,
            state: payload.state,
            coordinates: { latitude: payload.lat, longitude: payload.lng },
        });
    };

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

        // If we didn't get structured data (old fallback logic just in case)
        if (!location.street && !location.city) {
            // Try to parse components manually as fallback
            const parts = location.address.split(',');
            if (parts.length > 0) setAutoStreet(parts[0].trim());
        }

        setReference('');

        applyLocationToDraft({
            lat: location.lat,
            lng: location.lng,
            address: location.address,
            streetNumber: location.number || '',
            neighborhood: location.neighborhood || '',
            city: location.city || '',
            state: location.state || '',
        });
    };

    const handleGooglePlaceSelect = async (placeId: string, primaryText: string) => {
        const details = await getPlaceDetails(placeId);
        if (details) {
            const { formattedAddress, location, addressComponents } = details;

            setCepValidated(true);

            // 1. Try to use Google Address Components (Most accurate for the specific POI)
            let foundComponents = false;
            if (addressComponents) {
                // Parse Google Components
                // Schema: { longText, shortText, types: [] }
                // types: 'street_number', 'route', 'sublocality', 'administrative_area_level_2' (City), 'administrative_area_level_1' (State)

                let st = '', num = '', neigh = '', city = '', state = '';

                addressComponents.forEach(comp => {
                    if (comp.types.includes('route')) st = comp.longText;
                    if (comp.types.includes('street_number')) num = comp.longText;
                    if (comp.types.includes('sublocality') || comp.types.includes('sublocality_level_1')) neigh = comp.longText;
                    if (comp.types.includes('administrative_area_level_2')) city = comp.longText; // City
                    if (comp.types.includes('administrative_area_level_1')) state = comp.shortText; // UF
                });

                if (st || city) {
                    setAutoStreet(st);
                    setStreetNumber(num);
                    setAutoNeighborhood(neigh);
                    setAutoCity(city);
                    setAutoState(state);
                    foundComponents = true;

                    applyLocationToDraft({
                        lat: location.latitude,
                        lng: location.longitude,
                        address: formattedAddress,
                        streetNumber: num,
                        neighborhood: neigh,
                        city,
                        state,
                    });
                }
            }

            // 2. Fallback to Nominatim Reverse Geocoding if Google didn't give structure
            if (!foundComponents) {
                setLoadingCEP(true); // Reuse loading indicator
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&zoom=18&addressdetails=1`,
                        { headers: { 'User-Agent': 'RepairApp/1.0' } }
                    );
                    const data = await response.json();
                    if (data && data.address) {
                        const addr = data.address;
                        const street = addr.road || addr.pedestrian || '';
                        const neighborhood = addr.suburb || addr.neighbourhood || '';
                        const city = addr.city || addr.town || '';
                        const state = addr.state || '';
                        const number = addr.house_number || '';

                        setAutoStreet(street);
                        setAutoNeighborhood(neighborhood);
                        setAutoCity(city);
                        setAutoState(state);
                        setStreetNumber(number);

                        applyLocationToDraft({
                            lat: location.latitude,
                            lng: location.longitude,
                            address: formattedAddress,
                            streetNumber: number,
                            neighborhood,
                            city,
                            state,
                        });
                    }
                } catch (err) {
                    console.log('Error reverse geocoding', err);
                } finally {
                    setLoadingCEP(false);
                }
            }
        }
    };




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
        const isDifferent = category?.toLowerCase() !== (globalCategory || '')?.toLowerCase();
        if (category && isDifferent) {
            startDraft(category, mode as any);
        }
    }, [category, mode, globalCategory, startDraft]);

    // Reactive update: when hydrated ticket or location data becomes available
    React.useEffect(() => {
        // Sync with selected location (e.g. from Saved Addresses or Map)
        if (activeLoc) {
            // Apply structured data if available
            if (activeLoc.streetNumber) setStreetNumber(activeLoc.streetNumber);
            if (activeLoc.neighborhood) setAutoNeighborhood(activeLoc.neighborhood);
            if (activeLoc.city) setAutoCity(activeLoc.city);
            if (activeLoc.state) setAutoState(activeLoc.state);

            // Try to parse street from address line if structured specific street missing
            if (activeLoc.address) {
                const parts = activeLoc.address.split(',');
                if (parts.length > 0) {
                    setAutoStreet(parts[0].trim());
                }

                // CRITICAL FIX: If structured number is missing, try to extract from address string
                // Format usually: "Street, Number - Neighborhood"
                if (!activeLoc.streetNumber && parts.length > 1) {
                    const numberPart = parts[1].trim();
                    // Grab the first sequence of digits
                    const extractedNum = numberPart.match(/^\d+/);
                    if (extractedNum) {
                        setStreetNumber(extractedNum[0]);
                    }
                }
            }

            // Mark as validated since it came from a trusted source
            setCepValidated(true);

            // Auto-expand manual entry if street number is missing, urging user to fill it
            if (!activeLoc.streetNumber) {
                setIsManualEntryExpanded(true);
            }
        }

        if (ticket?.streetNumber && !streetNumber) setStreetNumber(ticket.streetNumber);
        if (ticket?.complement && !complement) setComplement(ticket.complement);
        if (ticket?.reference && !reference) setReference(ticket.reference);
        if (ticket?.reference && !reference) setReference(ticket.reference);

        // Auto-fill description from AI result if available and description is empty
        if (!description) {
            if (globalDesc) {
                setDescription(globalDesc);
            } else if (aiResult?.summary_for_provider) {
                setDescription(aiResult.summary_for_provider);
            } else if (aiResult?.problem_guess) {
                setDescription(aiResult.problem_guess);
            }
        }
    }, [ticket, globalDesc, activeLoc, aiResult]);

    React.useEffect(() => {
        if (!activeLoc?.address) {
            setShowAddressOptions(true);
        }
    }, [activeLoc?.address]);


    // Auth and Gate State
    // Auth and Gate State
    const { isGuest } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [authAction, setAuthAction] = useState<'submit' | null>(null);

    const handleNext = async () => {
        const selectedAddress = activeLoc?.address || liveLoc?.address || ticket?.address;

        // Validation
        if (!description.trim()) {
            Alert.alert('Descrição obrigatória', 'Por favor, descreva o problema antes de continuar.');
            return;
        }
        if (!streetNumber.trim()) {
            Alert.alert('Número obrigatório', 'Por favor, informe o número do endereço.');
            return;
        }
        // CEP is optional now, validation is looser if we have street/city
        if (!selectedAddress) {
            Alert.alert('Endereço obrigatório', 'Selecione um endereço válido para continuar.');
            return;
        }

        // Save Address Logic
        if (shouldSaveAddress && liveLoc) {
            await saveAddress({
                name: addressLabel || 'Meu Local',
                address: liveLoc.address,
                latitude: liveLoc.latitude,
                longitude: liveLoc.longitude,
                streetNumber,
                neighborhood: autoNeighborhood,
                city: autoCity,
                state: autoState,
                icon: 'MapPin' // Default icon
            });
        }

        // Sync local to global
        updateDraft(description, undefined, {
            streetNumber,
            complement,
            neighborhood: autoNeighborhood,
            city: autoCity,
            reference
        });

        if (isGuest) {
            setAuthAction('submit');
            setShowAuthModal(true);
            return;
        }

        if (mode === 'instant') {
            performSubmission();
            return;
        }

        submitAndNavigateToProvider();
    };

    const performSubmission = async () => {
        try {
            setIsSubmitting(true);
            await submitRequest(); // Global state -> searching
            router.push({
                pathname: '/request/new/match',
            });
        } catch {
            // Alert already shown by submitRequest
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitAndNavigateToProvider = async () => {
        try {
            setIsSubmitting(true);
            await submitRequest();
            router.push({ pathname: '/request/new/select-provider' });
        } catch {
            // Alert already shown by submitRequest
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAuthSuccess = () => {
        setShowAuthModal(false);

        setTimeout(() => {
            if (authAction === 'submit') {
                if (mode === 'instant') {
                    performSubmission();
                } else {
                    submitAndNavigateToProvider();
                }
            }
            setAuthAction(null);
        }, 450);
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

                            </>
                        )}

                        {description ? (
                            <>
                                <View style={styles.divider} />
                                <View style={styles.summarySection}>
                                    <Text style={styles.summaryLabel}>Detalhes Adicionais:</Text>
                                    <Text style={styles.summaryValue}>{description}</Text>
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

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {renderSummaryCard()}

                    {/* NEW DESCRIPTION INPUT (Only if AI result is missing) */}
                    {!aiResult && (
                        <Card style={[styles.card, { marginTop: 20 }]}>
                            <Text style={styles.question}>O que precisa ser feito?</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Descreva o problema (ex: Motor falhando, Pneu furado...)"
                                multiline
                            />
                        </Card>
                    )}

                    {/* Enhanced Apple-Style Address Form - ALWAYS VISIBLE */}
                    <Card style={[styles.card, { marginTop: 20 }]}>
                        <Text style={styles.question}>Endereço de Atendimento</Text>

                        <View style={styles.selectedAddressCard}>
                            <View style={styles.selectedAddressHeader}>
                                <Text style={styles.selectedAddressLabel}>Endereço selecionado</Text>
                                {cepValidated && (
                                    <View style={styles.validatedBadge}>
                                        <Text style={styles.validatedBadgeText}>Confirmado</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.selectedAddressValue}>
                                {activeLoc?.address || 'Nenhum endereço selecionado'}
                            </Text>
                            <TouchableOpacity
                                style={styles.changeAddressButton}
                                onPress={() => setShowAddressOptions((prev) => !prev)}
                            >
                                <Text style={styles.changeAddressButtonText}>
                                    {showAddressOptions ? 'Ocultar opções de alteração' : 'Alterar endereço'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {showAddressOptions && (
                            <>
                                {/* 1. SAVED ADDRESSES (Horizontal Scroll) */}
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={[styles.label, { marginBottom: 8 }]}>Seus Locais</Text>
                                    <SavedAddressesList
                                        onAddPress={() => {
                                            setShouldSaveAddress(true);
                                            setAddressLabel('Novo Local');
                                        }}
                                    />
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

                                <View style={{ marginBottom: 20 }}>
                                    <Text style={[styles.label, { marginBottom: 8 }]}>Buscar Endereço</Text>
                                    <GooglePlacesInput
                                        onSelect={handleGooglePlaceSelect}
                                        placeholder="Digite rua, número, bairro..."
                                    />
                                </View>

                                <View style={{ marginBottom: 20 }}>
                                    <TouchableOpacity
                                        onPress={() => setIsManualEntryExpanded(!isManualEntryExpanded)}
                                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5EA' }} />
                                        <Text style={{ marginHorizontal: 10, color: '#999', fontSize: 12 }}>
                                            OU PREENCHA MANUALMENTE {isManualEntryExpanded ? '▲' : '▼'}
                                        </Text>
                                        <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5EA' }} />
                                    </TouchableOpacity>
                                </View>

                                {/* 3. FORM INPUTS */}
                                <View style={{ gap: 12 }}>
                                    {isManualEntryExpanded && (
                                        <>
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
                                        </>
                                    )}

                                    {/* SAVE LOCATION UI - Unified Flow */}
                                    {liveLoc && (
                                        <View style={{ marginTop: 16 }}>
                                            {!shouldSaveAddress ? (
                                                <TouchableOpacity
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        paddingVertical: 12,
                                                        backgroundColor: '#FFF7ED',
                                                        borderWidth: 1,
                                                        borderColor: Colors.light.primary,
                                                        borderRadius: 12,
                                                    }}
                                                    onPress={() => {
                                                        setShouldSaveAddress(true);
                                                        setAddressLabel('🏠 Casa');
                                                    }}
                                                >
                                                    <MapPin size={20} color={Colors.light.primary} style={{ marginRight: 8 }} />
                                                    <Text style={{ color: Colors.light.primary, fontWeight: '600', fontSize: 15 }}>
                                                        Salvar este local para uso futuro
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={{
                                                    backgroundColor: '#f9f9fa',
                                                    padding: 12,
                                                    borderRadius: 12,
                                                    borderWidth: 1,
                                                    borderColor: '#E5E5EA'
                                                }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <Check size={16} color={Colors.light.success} style={{ marginRight: 6 }} />
                                                            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.light.success }}>
                                                                Salvando endereço
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity onPress={() => setShouldSaveAddress(false)}>
                                                            <Text style={{ fontSize: 12, color: '#999', textDecorationLine: 'underline' }}>
                                                                Não salvar
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    <Text style={styles.label}>Nome do local</Text>
                                                    <TextInput
                                                        style={[styles.miniInput, { marginBottom: 0, backgroundColor: '#fff' }]}
                                                        value={addressLabel}
                                                        onChangeText={setAddressLabel}
                                                        placeholder="Ex: 🏠 Casa de Praia"
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </>
                        )}
                    </Card>

                    <View style={{ height: 40 }} />
                </ScrollView>

                <View style={styles.footer}>
                    <Text style={styles.footerHint}>
                        Ao continuar, os dados do chamado serão vinculados automaticamente ao seu pedido.
                    </Text>
                    <Button
                        title={isSubmitting ? 'Enviando...' : mode === 'instant' ? "Chamar Agora" : mode === 'workshop' ? "Agendar Visita" : "Publicar Pedido"}
                        onPress={handleNext}
                        disabled={isSubmitting}
                        loading={isSubmitting}
                    />
                </View>
            </KeyboardAvoidingView>

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
    footerHint: {
        textAlign: 'center',
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 10,
    },
    selectedAddressCard: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#DBEAFE',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
    },
    selectedAddressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    selectedAddressLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1E3A8A',
    },
    validatedBadge: {
        backgroundColor: '#DCFCE7',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    validatedBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#166534',
    },
    selectedAddressValue: {
        fontSize: 14,
        color: '#1F2937',
        lineHeight: 20,
        fontWeight: '600',
    },
    changeAddressButton: {
        marginTop: 10,
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
    },
    changeAddressButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1D4ED8',
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
