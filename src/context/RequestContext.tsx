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
import { Provider, Ticket, TicketStatus, TicketTrack, UserAddress } from '@/types';
import { getItem, removeItem, saveItem, STORAGE_KEYS } from '@/utils/storage';
import { RealtimeChannel } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const RequestContext = createContext<RequestContextType | undefined>(undefined);

const MOCK_ADDRESSES: UserAddress[] = [
    {
        id: 'addr_1',
        label: 'Casa',
        address: 'Av. Carlos Gomes, 123 - Centro, Porto Velho - RO',
        coordinates: { latitude: -8.76183, longitude: -63.90177 },
        isDefault: true,
    },
    {
        id: 'addr_2',
        label: 'Trabalho',
        address: 'R. Sete de Setembro, 800 - Centro, Porto Velho - RO',
        coordinates: { latitude: -8.7650, longitude: -63.9000 },
        isDefault: false,
    },
];

export function RequestProvider({ children }: { children: React.ReactNode }) {
    // ============================================
    // ESTADOS (VARIÁVEIS QUE MUDAM)
    // ============================================

    const [currentTicket, setCurrentTicket] = useState<Partial<Ticket> | null>(null);
    const [status, setStatus] = useState<TicketStatus | 'idle' | 'drafting'>('idle');
    const [category, setCategory] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [track, setTrack] = useState<TicketTrack | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(MOCK_ADDRESSES[0]);
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

    const normalizeStatus = (raw?: string | null): TicketStatus | 'idle' | 'drafting' => {
        if (!raw) return 'idle';
        const status = raw.toString();
        const normalized = status.toLowerCase();
        const map: Record<string, TicketStatus> = {
            new: 'NEW',
            offered: 'OFFERED',
            finding: 'finding',
            answered: 'answered',
            accepted: 'ACCEPTED',
            paid: 'PAID',
            en_route: 'EN_ROUTE',
            done: 'DONE',
            completed: 'DONE',
            canceled: 'CANCELED',
            cancelled: 'CANCELED',
            declined: 'declined',
            expired: 'expired',
            drafting: 'drafting' as any,
        };

        return map[normalized] || (status as TicketStatus);
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

    const subscribeToOrder = (orderId: string) => {
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
                            status: newStatus,
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
    };

    // ============================================
    // GATEKEEPING
    // ============================================

    const canSeeFullAddress = (): boolean => {
        if (!currentTicket) return false;
        return currentTicket.status === 'PAID' ||
            currentTicket.status === 'EN_ROUTE' ||
            currentTicket.status === 'DONE';
    };

    const canSeeContact = (): boolean => {
        if (!currentTicket) return false;
        return (currentTicket.status === 'PAID' ||
            currentTicket.status === 'EN_ROUTE' ||
            currentTicket.status === 'DONE') &&
            currentTicket.ticketFeePaid === true;
    };

    const startDraft = (cat: string, t: TicketTrack) => {
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
    };

    const updateDraft = (desc: string, images?: string[], addressDetails?: Partial<Ticket>) => {
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
    };

    const setAddress = (address: UserAddress) => {
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
    };

    const setFunnelAnswer = (qId: string, value: string) => {
        setFunnelAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const addQuestionsToHistory = (newQuestions: any[]) => {
        // Avoid duplicates based on ID
        setQuestionsHistory(prev => {
            const existingIds = new Set(prev.map(q => q.id));
            const filtered = newQuestions.filter(q => !existingIds.has(q.id));
            return [...prev, ...filtered];
        });
    };

    const resetFunnel = () => {
        setFunnelAnswers({});
        setQuestionsHistory([]);
        setAiResult(null);
    };

    const submitRequest = async (): Promise<string> => {
        // 1. Get Real User
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario nao autenticado');

        // 2. Preparar dados para Supabase
        const lat = currentTicket?.coordinates?.latitude ?? locationContext?.selectedLocation?.latitude;
        const lng = currentTicket?.coordinates?.longitude ?? locationContext?.selectedLocation?.longitude;
        const address = currentTicket?.address ?? locationContext?.selectedLocation?.address;

        // Calculate expiration for urgent/instant requests (2 minutes from now)
        const isUrgent = track === 'instant';
        const expiresAt = isUrgent ? new Date(Date.now() + 2 * 60 * 1000).toISOString() : null;

        const ticketData = {
            user_id: user.id,
            status: 'finding',
            category: category,
            user_text: description, // Changed from description to user_text
            address: address, // Changed from user_address to address
            answers_json: funnelAnswers,
            lat: lat,
            lng: lng,
            expires_at: expiresAt
        };

        try {
            console.log('🚀 Criando pedido no Supabase (Requests)...', ticketData);

            // 2. Insert na tabela 'requests'
            const { data, error } = await supabase
                .from('requests')
                .insert([ticketData])
                .select()
                .single();

            if (error) {
                console.error('❌ Erro ao criar pedido:', error);
                throw error;
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
            // Using require here to avoid import cycle issues if any, or just importing aiService at top
            // Using dynamic import to avoid potential circular dependencies
            const { aiService } = await import('@/services/aiService');

            aiService.analyzeRequest({
                requestId: newTicketId,
                category: category || 'general',
                answers: funnelAnswers,
                userText: description,
                lat: lat,
                lng: lng
            });


            // Simulation of provider matching (for demo purposes)
            const enableDemoMatching = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEMO_MATCHING === 'true';
            if (enableDemoMatching) {
                setTimeout(() => {
                    setStatus('ACCEPTED');
                    setAssignedProvider({
                        id: 'p1',
                        name: 'Carlos Oliveira',
                        category: category || 'hvac',
                        image: 'https://i.pravatar.cc/150?u=Carlos',
                        rating: 4.9,
                        reviews: 128,
                        status: 'online',
                        distance: '1.2 km',
                        isPremium: true,
                        coordinates: {
                            latitude: lat ? lat + 0.005 : -8.76,
                            longitude: lng ? lng + 0.005 : -63.90
                        }
                    } as any);
                }, 8000); // Increased to give AI more time to shine
            }

            return newTicketId;

        } catch (e) {
            console.error(e);
            // Fallback para mock se falhar (para garantir a experiência na demo)
            const mockId = `mock_ticket_${Date.now()}`;
            console.log('⚠️ Fallback: Usando ID Mock', mockId);
            setStatus('finding');
            return mockId;
        }
    };

    const cancelRequest = async () => {
        // Se tiver um ID real, tentar cancelar no banco também
        if (currentTicket?.id && !currentTicket.id.startsWith('mock_')) {
            try {
                await supabase
                    .from('requests')
                    .update({ status: 'canceled' })
                    .eq('id', currentTicket.id);
            } catch (e) {
                console.error('Erro ao cancelar no supabase', e);
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
    };

    const completeRequest = () => {
        setStatus('DONE');
        if (currentTicket) {
            setCurrentTicket({
                ...currentTicket,
                status: 'DONE',
                completedAt: new Date().toISOString(),
            });
        }
    };

    return (
        <RequestContext.Provider value={{
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
            addQuestionsToHistory
        }}>
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
