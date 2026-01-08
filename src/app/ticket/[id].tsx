import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { TicketStatus } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
    CheckCircle, 
    Clock, 
    CreditCard, 
    MapPin, 
    MessageCircle, 
    Package, 
    Phone, 
    Shield, 
    Truck,
    X 
} from 'lucide-react-native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: any; color: string; bg: string }> = {
    NEW: { label: 'Aguardando Respostas', icon: Clock, color: '#3B82F6', bg: '#DBEAFE' },
    OFFERED: { label: 'Propostas Recebidas', icon: Package, color: '#8B5CF6', bg: '#EDE9FE' },
    ACCEPTED: { label: 'Aguardando Pagamento', icon: CreditCard, color: '#F59E0B', bg: '#FEF3C7' },
    PAID: { label: 'Pagamento Confirmado', icon: CheckCircle, color: Colors.light.success, bg: Colors.light.successBackground },
    EN_ROUTE: { label: 'A caminho', icon: Truck, color: Colors.light.primary, bg: '#FFF4E6' },
    DONE: { label: 'Concluído', icon: CheckCircle, color: Colors.light.success, bg: Colors.light.successBackground },
    CANCELED: { label: 'Cancelado', icon: X, color: '#EF4444', bg: '#FEE2E2' },
};

export default function TicketDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { currentTicket, canSeeFullAddress, canSeeContact } = useRequest();

    // In real app, fetch ticket by ID
    const ticket = currentTicket;

    if (!ticket || !ticket.status) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Ticket não encontrado</Text>
            </SafeAreaView>
        );
    }

    const statusConfig = STATUS_CONFIG[ticket.status as TicketStatus];
    const StatusIcon = statusConfig.icon;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Status Header */}
                <View style={[styles.statusHeader, { backgroundColor: statusConfig.bg }]}>
                    <StatusIcon size={24} color={statusConfig.color} />
                    <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                </View>

                {/* Ticket Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Detalhes do Serviço</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Categoria</Text>
                        <Text style={styles.infoValue}>{ticket.category}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Descrição</Text>
                        <Text style={styles.infoValue}>{ticket.description}</Text>
                    </View>
                    {ticket.track && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Tipo</Text>
                            <Text style={styles.infoValue}>
                                {ticket.track === 'instant' ? 'Reparo Rápido' :
                                 ticket.track === 'evaluation' ? 'Precisa Avaliar' :
                                 'Levar para Oficina'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Location (with gatekeeping) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Localização</Text>
                    {canSeeFullAddress() && ticket.address ? (
                        <View style={styles.locationCard}>
                            <MapPin size={20} color={Colors.light.primary} />
                            <Text style={styles.addressText}>{ticket.address}</Text>
                        </View>
                    ) : (
                        <View style={styles.locationCard}>
                            <MapPin size={20} color="#999" />
                            <View>
                                <Text style={styles.addressText}>
                                    {ticket.region || ticket.neighborhood || 'Região não informada'}
                                </Text>
                                <Text style={styles.gatekeepingHint}>
                                    Endereço completo será liberado após pagamento
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Provider Info */}
                {ticket.providerId && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Profissional</Text>
                        <View style={styles.providerCard}>
                            <Text style={styles.providerName}>{ticket.providerName || 'Profissional'}</Text>
                            {canSeeContact() && (
                                <View style={styles.contactRow}>
                                    <Button
                                        title="Ligar"
                                        variant="outline"
                                        size="sm"
                                        leftIcon={<Phone size={16} color={Colors.light.primary} />}
                                        onPress={() => {}}
                                    />
                                    <View style={{ width: 10 }} />
                                    <Button
                                        title="WhatsApp"
                                        variant="outline"
                                        size="sm"
                                        leftIcon={<MessageCircle size={16} color={Colors.light.primary} />}
                                        onPress={() => {}}
                                    />
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Payment Info */}
                {ticket.ticketFee && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Pagamento</Text>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Taxa do Ticket</Text>
                            <Text style={styles.infoValue}>
                                {ticket.ticketFeePaid ? '✓ Pago' : 'Pendente'}
                            </Text>
                        </View>
                        {ticket.servicePrice && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Valor do Serviço</Text>
                                <Text style={[styles.infoValue, styles.priceText]}>
                                    R$ {ticket.servicePrice.toFixed(2)}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Warranty */}
                {ticket.warranty && (
                    <View style={styles.section}>
                        <View style={styles.warrantyHeader}>
                            <Shield size={20} color={Colors.light.primary} />
                            <Text style={styles.sectionTitle}>Garantia</Text>
                        </View>
                        <View style={styles.warrantyCard}>
                            <Text style={styles.warrantyText}>
                                Válida até {new Date(ticket.warranty.expiresAt).toLocaleDateString('pt-BR')}
                            </Text>
                            <Button
                                title="Acionar Garantia"
                                variant="outline"
                                onPress={() => {
                                    // Reopen ticket
                                }}
                            />
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                    {ticket.status === 'NEW' && (
                        <Button
                            title="Cancelar Solicitação"
                            variant="ghost"
                            onPress={() => router.back()}
                        />
                    )}
                    {ticket.status === 'ACCEPTED' && !ticket.ticketFeePaid && (
                        <Button
                            title="Pagar Taxa do Ticket"
                            onPress={() => {
                                // Navigate to payment
                            }}
                        />
                    )}
                    {ticket.status === 'EN_ROUTE' && (
                        <Button
                            title="Acompanhar"
                            onPress={() => {
                                // Show map with provider location
                            }}
                        />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    scrollContent: {
        padding: 20,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    statusLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: '#666',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.text,
        flex: 1,
        textAlign: 'right',
    },
    priceText: {
        color: Colors.light.primary,
        fontSize: 16,
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    addressText: {
        fontSize: 14,
        color: Colors.light.text,
        marginLeft: 10,
        flex: 1,
    },
    gatekeepingHint: {
        fontSize: 11,
        color: '#999',
        marginTop: 4,
        marginLeft: 10,
        fontStyle: 'italic',
    },
    providerCard: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    providerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 12,
    },
    contactRow: {
        flexDirection: 'row',
    },
    warrantyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    warrantyCard: {
        padding: 12,
        backgroundColor: '#F0F9E6',
        borderRadius: 8,
    },
    warrantyText: {
        fontSize: 14,
        color: Colors.light.text,
        marginBottom: 12,
    },
    actions: {
        marginTop: 20,
        marginBottom: 40,
    },
    errorText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        marginTop: 50,
    },
});

