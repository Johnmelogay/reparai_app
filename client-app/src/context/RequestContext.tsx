/**
 * File: src/context/RequestContext.tsx
 * Purpose: Global state management for the Order/Request lifecycle.
 * Key Features:
 * - Manages the "Draft" ticket state before submission.
 * - Handles the transition from "Searching" -> "Matched" -> "In Progress".
 * - Subscribes to Supabase Realtime updates for order status changes.
 * - Provides helper functions to create orders and cancel requests.
 */
import { DiagnosticQuestion } from '@/services/aiService';
import { supabase } from '@/services/supabase';
import { ContextStatus, Provider, Ticket, TicketStatus, TicketTrack, UserAddress } from '@/types';
import { logger } from '@/utils/logger';
import { getItem, removeItem, saveItem, STORAGE_KEYS } from '@/utils/storage';
import { RealtimeChannel } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useLocation } from './LocationContext';

/**
 * ============================================
 * CONTEXTO DE SOLICITAÇÕES (REQUEST CONTEXT)
 * ============================================
 * 
 * Agora Integrado com Supabase!
 */

interface RequestState {
    currentTicket: Partial<Ticket> | null;
    status: TicketStatus | 'idle' | 'drafting';
    category: string | null;
    description: string;
    track: TicketTrack | null;
    selectedAddress: UserAddress | null;
    assignedProvider: Provider | null;
    providerLocation: { latitude: number; longitude: number } | null;
    eta: number | null;
    offers: Array<{ provider: Provider; price: number; estimatedTime: number; message?: string }>;
    funnelAnswers: Record<string, string>;
    questionsHistory: DiagnosticQuestion[]; // Store the actual questions asked
    aiResult: any; // Store AI analysis result
    finalConfidence: number; // Store final AI confidence score
}

interface RequestContextType extends RequestState {
    startDraft: (category: string, track: TicketTrack) => void;
    updateDraft: (description: string, images?: string[], addressDetails?: Partial<Ticket>) => void;
    setAddress: (address: UserAddress) => void;
    setFunnelAnswer: (questionId: string, value: string) => void;
    addQuestionsToHistory: (questions: DiagnosticQuestion[]) => void; // New action
    setAiResult: (result: any) => void;
    setFinalConfidence: (confidence: number) => void;
    resetFunnel: () => void;
    submitRequest: () => Promise<string>;
    cancelRequest: () => void;
    completeRequest: () => void;
    // Funções de simulação/manual ainda úteis
    setStatus: (status: TicketStatus | 'idle' | 'drafting') => void;
    setAssignedProvider: (provider: Provider | null) => void;
    setOffers: (offers: Array<{ provider: Provider; price: number; estimatedTime: number; message?: string }>) => void;
    canSeeFullAddress: () => boolean;
    canSeeContact: () => boolean;

    // Testing/Simulation helpers
    setProviderLocation: (loc: { latitude: number; longitude: number } | null) => void;
    setEta: (eta: number | null) => void;
    loadTicket: (ticketId: string) => Promise<void>;
}

const RequestContext = createContext<RequestContextType | undefined>(undefined);

// No more hardcoded addresses — use LocationContext for real user location

export function RequestProvider({ children }: { children: React.ReactNode }) {
    // ============================================
    // ESTADOS (VARIÁVEIS QUE MUDAM)
    // ============================================

    const [currentTicket, setCurrentTicket] = useState<Partial<Ticket> | null>(null);
    const [status, setStatus] = useState<ContextStatus>('idle');
    const [category, setCategory] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [track, setTrack] = useState<TicketTrack | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
    const [assignedProvider, setAssignedProvider] = useState<Provider | null>(null);
    const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [eta, setEta] = useState<number | null>(null);
    const [offers, setOffers] = useState<Array<{ provider: Provider; price: number; estimatedTime: number; message?: string }>>([]);
    const [funnelAnswers, setFunnelAnswers] = useState<Record<string, string>>({});
    const [questionsHistory, setQuestionsHistory] = useState<DiagnosticQuestion[]>([]);
    const [aiResult, setAiResult] = useState<any>(null);
    const [finalConfidence, setFinalConfidence] = useState<number>(0);

    const locationContext = useLocation();

    // Referência para o canal de subscription
    const [orderChannel, setOrderChannel] = useState<RealtimeChannel | null>(null);

    const normalizeStatus = (raw?: string | null): ContextStatus => {
        if (!raw) return 'idle';
        const lower = raw.toString().toLowerCase();
        const map: Record<string, ContextStatus> = {
            // Legacy UPPER_CASE → new lowercase
            new: 'finding',
            offered: 'offered',
            finding: 'finding',
            answered: 'offered',
            accepted: 'accepted',
            paid: 'paid',
            en_route: 'en_route',
            done: 'completed',
            completed: 'completed',
            canceled: 'canceled',
            cancelled: 'canceled',
            declined: 'canceled',
            expired: 'canceled',
            drafting: 'drafting',
            idle: 'idle',
        };

        return map[lower] || (lower as ContextStatus);
    };

    const normalizeRequestCategory = (raw?: string | null): string | null => {
        if (!raw) return null;
        const value = raw.toLowerCase().trim();
        if (!value) return null;

        if (['mobilidade', 'auto', 'mecanica', 'mecânica', 'car'].includes(value)) return 'mobilidade';
        if (['tecnologia', 'technology', 'tech', 'electronics', 'eletronicos', 'eletrônicos'].includes(value)) return 'tecnologia';
        if (
            [
                'casa',
                'home',
                'hvac',
                'plumbing',
                'gardening',
                'cleaning',
                'beauty',
                'carpentry',
                'pest_control',
                'handyman',
                'electrical',
            ].includes(value)
        ) return 'casa';

        return value;
    };

    // ============================================
    // PERSISTÊNCIA & HYDRATE
    // ============================================

    useEffect(() => {
        const hydrate = async () => {
            const savedDraft = await getItem<Partial<Ticket>>(STORAGE_KEYS.ACTIVE_DRAFT);
            if (savedDraft) {
                setCurrentTicket(savedDraft);
                setStatus(normalizeStatus(savedDraft.status as any || 'drafting'));
                setCategory(savedDraft.category || null);
                setTrack(savedDraft.track || null);
                setDescription(savedDraft.description || '');

                // Se já estiver em um status ativo (não rascunho), reconectar realtime
                if (savedDraft.id && savedDraft.status && (savedDraft.status as string) !== 'drafting') {
                    subscribeToOrder(savedDraft.id);
                }
            }
        };
        hydrate();
    }, []);

    const saveDraft = (ticket: Partial<Ticket> | null) => {
        if (ticket) {
            saveItem(STORAGE_KEYS.ACTIVE_DRAFT, ticket);
        } else {
            removeItem(STORAGE_KEYS.ACTIVE_DRAFT);
        }
    };



    // ============================================
    // SUPABASE REALTIME LOGIC
    // ============================================

    // ============================================
    // SUPABASE REALTIME LOGIC
    // ============================================

    const subscribeToOrder = useCallback((orderId: string) => {
        // Limpar subscription anterior se existir
        if (orderChannel) {
            supabase.removeChannel(orderChannel);
        }

        console.log(`🔌 Conectando ao pedido ${orderId} no Supabase...`);

        const channel = supabase
            .channel(`request_${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'requests',
                    filter: `id=eq.${orderId}`,
                },
                (payload) => {
                    console.log('⚡ Atualização do Pedido recebida:', payload);
                    const newStatus = normalizeStatus(payload.new.status);
                    const newProviderId = payload.new.provider_id;
                    const aiJson = payload.new.ai_result_json;

                    // Atualizar estado local
                    setStatus(newStatus);
                    if (aiJson) {
                        setAiResult(aiJson);
                    }

                    setCurrentTicket(prev => {
                        const updated = {
                            ...prev,
                            status: newStatus as TicketStatus, // DB values are always valid TicketStatus
                            providerId: newProviderId,
                        };
                        // Importante: salvar atualização no storage para persistir entre reloads
                        saveDraft(updated);
                        return updated;
                    });

                    // Se foi aceito, buscar dados do parceiro (TODO)
                    if (newProviderId && !assignedProvider) {
                        // fetchPartnerDetails(newProviderId);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ Conectado ao canal do pedido ${orderId}`);
                }
            });

        setOrderChannel(channel);
    }, [orderChannel, assignedProvider]);

    const loadTicket = useCallback(async (ticketId: string) => {
        try {
            const { data, error } = await supabase
                .from('requests')
                .select('*')
                .eq('id', ticketId)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Ticket não encontrado');

            const normalizedStatus = normalizeStatus(data.status);
            const ticketObj: Partial<Ticket> = {
                id: data.id,
                status: normalizedStatus as TicketStatus,
                category: data.category,
                description: data.user_text || '',
                coordinates: { latitude: data.lat, longitude: data.lng },
                address: data.address,
            };

            setCurrentTicket(ticketObj);
            setStatus(normalizedStatus);
            setCategory(data.category);
            setDescription(data.user_text || '');
            if (data.ai_result_json) setAiResult(data.ai_result_json);

            subscribeToOrder(data.id);
            saveDraft(ticketObj);

            // Fetch partner if assigned
            if (data.provider_id) {
                const { data: partnerData } = await supabase
                    .from('partners')
                    .select('*')
                    .eq('id', data.provider_id)
                    .single();

                if (partnerData) {
                    setAssignedProvider({
                        id: partnerData.id,
                        name: partnerData.full_name,
                        image: partnerData.avatar_url,
                        rating: partnerData.rating || 5.0,
                        reviews: partnerData.reviews_count || 0,
                        category: partnerData.service_category,
                        categories: [partnerData.service_category],
                        visitPrice: '0',
                        distance: '---',
                        coordinates: { latitude: partnerData.lat, longitude: partnerData.long },
                        status: partnerData.is_online ? 'online' : 'offline',
                        badges: [],
                        address: partnerData.address_label || '',
                        operationalScore: partnerData.operational_score || 100
                    });
                }
            }
        } catch (e) {
            console.error('Error loading ticket into context:', e);
        }
    }, [subscribeToOrder]);

    // ============================================
    // GATEKEEPING
    // ============================================

    const canSeeFullAddress = useCallback((): boolean => {
        if (!currentTicket) return false;
        return currentTicket.status === 'paid' ||
            currentTicket.status === 'en_route' ||
            currentTicket.status === 'completed';
    }, [currentTicket]);

    const canSeeContact = useCallback((): boolean => {
        if (!currentTicket) return false;
        return (currentTicket.status === 'paid' ||
            currentTicket.status === 'en_route' ||
            currentTicket.status === 'completed') &&
            currentTicket.ticketFeePaid === true;
    }, [currentTicket]);

    const startDraft = useCallback((cat: string, t: TicketTrack) => {
        setCategory(cat);
        setTrack(t);
        setStatus('drafting');
        setDescription('');

        // Se estiver começando novo, limpa canal anterior
        if (orderChannel) {
            supabase.removeChannel(orderChannel);
            setOrderChannel(null);
        }

        resetFunnel();

        const newTicket: Partial<Ticket> = {
            category: cat,
            track: t,
            description: '',
            status: 'drafting' as any,
            address: locationContext?.selectedLocation?.address || selectedAddress?.address,
            neighborhood: locationContext?.selectedLocation?.neighborhood || selectedAddress?.neighborhood,
            streetNumber: locationContext?.selectedLocation?.streetNumber || selectedAddress?.streetNumber,
            city: locationContext?.selectedLocation?.city || selectedAddress?.city,
            state: locationContext?.selectedLocation?.state || selectedAddress?.state,
            coordinates: locationContext?.selectedLocation ? {
                latitude: locationContext.selectedLocation.latitude,
                longitude: locationContext.selectedLocation.longitude,
            } : selectedAddress?.coordinates,
        };

        setCurrentTicket(newTicket);
        saveDraft(newTicket);
    }, [orderChannel, locationContext?.selectedLocation, selectedAddress]);

    const updateDraft = useCallback((desc: string, images?: string[], addressDetails?: Partial<Ticket>) => {
        setDescription(desc);
        setCurrentTicket(prev => {
            const updated = {
                ...prev,
                description: desc,
                images: images || prev?.images,
                ...addressDetails
            };
            saveDraft(updated);
            return updated;
        });
    }, []);

    const setAddress = useCallback((address: UserAddress) => {
        setSelectedAddress(address);
        setCurrentTicket(prev => {
            const updated = {
                ...prev,
                address: address.address,
                streetNumber: address.streetNumber,
                complement: address.complement,
                neighborhood: address.neighborhood,
                city: address.city,
                state: address.state,
                coordinates: address.coordinates,
            };
            saveDraft(updated);
            return updated;
        });
    }, []);

    const setFunnelAnswer = useCallback((qId: string, value: string) => {
        setFunnelAnswers(prev => ({ ...prev, [qId]: value }));
    }, []);

    const addQuestionsToHistory = useCallback((newQuestions: any[]) => {
        // Avoid duplicates based on ID
        setQuestionsHistory(prev => {
            const existingIds = new Set(prev.map(q => q.id));
            const filtered = newQuestions.filter(q => !existingIds.has(q.id));
            return [...prev, ...filtered];
        });
    }, []);

    const resetFunnel = useCallback(() => {
        setFunnelAnswers({});
        setQuestionsHistory([]);
        setAiResult(null);
    }, []);

    const getErrorMessage = (error: unknown): string => {
        if (error && typeof error === 'object') {
            const maybe = error as { message?: string; details?: string; hint?: string };
            const parts = [maybe.message, maybe.details, maybe.hint].filter(Boolean);
            if (parts.length > 0) return parts.join(' | ');
        }
        if (error instanceof Error) return error.message;
        return String(error);
    };

    const isStatementTimeout = (message: string): boolean =>
        /statement timeout|canceling statement due to statement timeout/i.test(message);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const submitRequest = useCallback(async (): Promise<string> => {
        // 1. Get Real User
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario nao autenticado');

        // 2. Preparar dados para Supabase
        const lat = currentTicket?.coordinates?.latitude ?? locationContext?.selectedLocation?.latitude;
        const lng = currentTicket?.coordinates?.longitude ?? locationContext?.selectedLocation?.longitude;
        const address = currentTicket?.address ?? locationContext?.selectedLocation?.address;
        const neighborhood = currentTicket?.neighborhood ?? locationContext?.selectedLocation?.neighborhood;
        const city = currentTicket?.city ?? locationContext?.selectedLocation?.city;
        const state = currentTicket?.state ?? locationContext?.selectedLocation?.state;
        const street_number = currentTicket?.streetNumber ?? locationContext?.selectedLocation?.streetNumber;
        const resolvedCategory = normalizeRequestCategory(currentTicket?.category ?? category);
        const resolvedDescription = currentTicket?.description ?? description;

        if (!resolvedCategory) {
            throw new Error('Categoria não definida para o pedido.');
        }
        if (lat == null || lng == null || !address) {
            throw new Error('Endereço incompleto. Selecione um endereço válido antes de enviar.');
        }

        // Keep a practical matchmaking window for instant requests.
        // 2 minutes was too short in real-world mobile conditions (GPS + realtime + user switching apps).
        const isUrgent = track === 'instant';
        const expiresAt = isUrgent ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;

        const ticketData = {
            user_id: user.id,
            status: 'finding',
            category: resolvedCategory,
            user_text: resolvedDescription,
            address: address, // Changed from user_address to address
            neighborhood: neighborhood,
            city: city,
            state: state,
            street_number: street_number,
            answers_json: funnelAnswers,
            lat: lat,
            lng: lng,
            expires_at: expiresAt
        };

        try {
            logger.info('Criando pedido no Supabase (requests)...');

            const insertRequest = async (payload: Record<string, unknown>) => {
                return supabase
                    .from('requests')
                    .insert([payload])
                    .select('id, status, created_at, updated_at')
                    .single();
            };

            let data: { id: string; status?: string; created_at?: string; updated_at?: string } | null = null;
            let error: any = null;
            let payloadForRetry = { ...ticketData } as Record<string, unknown>;

            // 2) Retry path for transient DB timeouts
            for (let attempt = 1; attempt <= 3; attempt++) {
                ({ data, error } = await insertRequest(payloadForRetry));
                if (!error) break;

                const msg = getErrorMessage(error);

                // Backward-compatible fallback if `expires_at` is not available yet.
                if (/expires_at|column .* does not exist/i.test(msg) && 'expires_at' in payloadForRetry) {
                    const { expires_at, ...legacyPayload } = payloadForRetry as any;
                    payloadForRetry = legacyPayload;
                    ({ data, error } = await insertRequest(payloadForRetry));
                    if (!error) break;
                }

                if (isStatementTimeout(msg) && attempt < 3) {
                    logger.warn(`Timeout ao criar pedido (tentativa ${attempt}/3). Repetindo...`, { msg });
                    await sleep(attempt * 450);
                    continue;
                }

                break;
            }

            // 3) Last-resort fallback: create as "new" (avoids heavy trigger path) then promote to "finding"
            if (error && isStatementTimeout(getErrorMessage(error))) {
                logger.warn('Aplicando fallback de criação com status "new" devido a timeout');
                const degradedPayload = {
                    ...payloadForRetry,
                    status: 'new',
                };
                ({ data, error } = await insertRequest(degradedPayload));

                if (!error && data?.id) {
                    const { error: promoteError } = await supabase
                        .from('requests')
                        .update({ status: 'finding' })
                        .eq('id', data.id);

                    if (promoteError) {
                        logger.warn('Falha ao promover pedido de "new" para "finding"', promoteError);
                    }
                }
            }

            if (error || !data?.id) {
                throw error || new Error('Não foi possível criar o pedido.');
            }

            const newTicketId = data.id;
            console.log('✅ Pedido criado com sucesso! ID:', newTicketId);

            // 3. Atualizar estado local
            const createdTicket: Partial<Ticket> = {
                ...currentTicket,
                id: newTicketId,
                status: 'finding',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            setCurrentTicket(createdTicket);
            setStatus('finding');
            saveDraft(createdTicket);

            // 4. Iniciar escuta Realtime
            subscribeToOrder(newTicketId);

            // 5. Call AI Analysis (Async)
            const { aiService } = await import('@/services/aiService');

            aiService.analyzeRequest({
                requestId: newTicketId,
                category: resolvedCategory || 'general',
                answers: funnelAnswers,
                userText: resolvedDescription,
                lat: lat,
                lng: lng
            });


            return newTicketId;

        } catch (e) {
            const message = getErrorMessage(e);
            logger.warn('submitRequest failed', { message });
            setStatus('idle');
            Alert.alert(
                'Erro ao enviar solicitação',
                message,
                [
                    { text: 'OK' }
                ]
            );
            throw e; // Propagate error — callers must handle it
        }
    }, [currentTicket, locationContext?.selectedLocation, category, description, funnelAnswers, track, subscribeToOrder]);

    const cancelRequest = useCallback(async () => {
        // Cancel on the database if we have a real ticket
        if (currentTicket?.id) {
            try {
                await supabase
                    .from('requests')
                    .update({ status: 'canceled' })
                    .eq('id', currentTicket.id);
            } catch (e) {
                logger.error('Failed to cancel request on Supabase', e);
            }
        }

        if (orderChannel) {
            supabase.removeChannel(orderChannel);
            setOrderChannel(null);
        }

        setStatus('idle');
        setCurrentTicket(null);
        setAssignedProvider(null);
        setProviderLocation(null);
        setEta(null);
        setDescription('');
        setCategory(null);
        setTrack(null);
        setOffers([]);
        saveDraft(null);
    }, [currentTicket, orderChannel]);

    const completeRequest = useCallback(() => {
        setStatus('completed');
        if (currentTicket) {
            setCurrentTicket({
                ...currentTicket,
                status: 'completed',
                completedAt: new Date().toISOString(),
            });
        }
    }, [currentTicket]);

    const contextValue = useMemo(() => ({
        currentTicket,
        status,
        category,
        description,
        track: track || null,
        selectedAddress,
        assignedProvider,
        providerLocation,
        eta,
        offers,
        startDraft,
        updateDraft,
        setAddress,
        submitRequest,
        cancelRequest,
        completeRequest,
        setStatus,
        setAssignedProvider,
        setOffers,
        canSeeFullAddress,
        canSeeContact,
        setProviderLocation, // @ts-ignore
        setEta,              // @ts-ignore
        funnelAnswers,
        setFunnelAnswer,
        aiResult,
        setAiResult,
        finalConfidence,
        setFinalConfidence,
        resetFunnel,
        questionsHistory,
        addQuestionsToHistory,
        loadTicket
    }), [
        currentTicket,
        status,
        category,
        description,
        track,
        selectedAddress,
        assignedProvider,
        providerLocation,
        eta,
        offers,
        startDraft,
        updateDraft,
        setAddress,
        submitRequest,
        cancelRequest,
        completeRequest,
        setStatus,
        setAssignedProvider,
        setOffers,
        canSeeFullAddress,
        canSeeContact,
        setProviderLocation,
        setEta,
        funnelAnswers,
        setFunnelAnswer,
        aiResult,
        setAiResult,
        finalConfidence,
        setFinalConfidence,
        resetFunnel,
        questionsHistory,
        addQuestionsToHistory,
        loadTicket
    ]);

    return (
        <RequestContext.Provider value={contextValue}>
            {children}
        </RequestContext.Provider>
    );
}

export const useRequest = () => {
    const context = useContext(RequestContext);
    if (!context) {
        throw new Error('useRequest must be used within a RequestProvider');
    }
    return context;
};
