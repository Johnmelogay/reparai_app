/**
 * File: src/components/ui/ServiceCard.tsx
 * Purpose: Reusable Card component for displaying Service Order details.
 * Key Features:
 * - Comprehensive status visualization (Color-coded pills).
 * - Handles Layout for Title, Provider Info, Operational Details (Time, Location).
 * - Integrated Warranty visualizer (Progress bar + Status).
 * - Supports primary actions (e.g., "Acionar Garantia").
 */
import { Colors, Layout } from '@/constants/Colors';
import {
    Calendar,
    CheckCircle2,
    Clock,
    Info,
    MapPin,
    MessageCircle,
    ShieldCheck,
    Star,
    XCircle
} from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

export type ServiceStatus =
    | 'ANALYSIS'
    | 'WAITING_BUDGET'
    | 'SCHEDULED'
    | 'IN_PROGRESS'
    | 'FINISHED'
    | 'CANCELED';

interface ServiceCardProps {
    orderIdShort: string;
    status: ServiceStatus;
    title: string;
    category: string;
    providerName: string;
    providerRating?: number;
    providerVerified?: boolean;
    providerImage?: string;
    dateTime: string;
    locationLabel: string;
    priceLabel: string;
    hasWarranty?: boolean;
    warrantyStartDate?: string; // ISO string
    warrantyEndDate?: string;   // ISO string
    onPress?: () => void;
    onPrimaryAction?: () => void;
    onSecondaryAction?: () => void;
    onChatPress?: () => void;
    style?: ViewStyle;
}

const getStatusConfig = (status: ServiceStatus) => {
    switch (status) {
        case 'ANALYSIS':
            return { label: 'Em análise', color: '#F59E0B', bgColor: '#FEF3C7', icon: Clock };
        case 'WAITING_BUDGET':
            return { label: 'Aguardando orçamento', color: '#EA580C', bgColor: '#FFEDD5', icon: Clock };
        case 'SCHEDULED':
            return { label: 'Agendado', color: '#6366F1', bgColor: '#EEF2FF', icon: Calendar };
        case 'IN_PROGRESS':
            return { label: 'Em andamento', color: '#0EA5E9', bgColor: '#E0F2FE', icon: MapPin };
        case 'FINISHED':
            return { label: 'Finalizado', color: '#64748B', bgColor: '#F1F5F9', icon: CheckCircle2 };
        case 'CANCELED':
            return { label: 'Cancelado', color: '#94A3B8', bgColor: '#F8FAFC', icon: XCircle };
        default:
            return { label: status, color: '#64748B', bgColor: '#F1F5F9', icon: Info };
    }
};

export function ServiceCard({
    orderIdShort,
    status,
    title,
    category,
    providerName,
    providerRating = 4.8,
    providerVerified = true,
    providerImage,
    dateTime,
    locationLabel,
    priceLabel,
    hasWarranty = false,
    warrantyStartDate,
    warrantyEndDate,
    onPress,
    onPrimaryAction,
    onSecondaryAction,
    onChatPress,
    style,
}: ServiceCardProps) {
    const statusConfig = getStatusConfig(status);
    const StatusIcon = statusConfig.icon;

    // Client-side Warranty calculation
    const isFinished = status === 'FINISHED';

    let warrantyProgress = 0;
    let daysRemaining = 0;
    let totalDays = 0;
    let isWarrantyExpired = false;

    if (hasWarranty && warrantyStartDate && warrantyEndDate) {
        const start = new Date(warrantyStartDate).getTime();
        const end = new Date(warrantyEndDate).getTime();
        const now = new Date().getTime();

        totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        warrantyProgress = Math.max(0, Math.min(1, daysRemaining / totalDays));
        isWarrantyExpired = daysRemaining <= 0;
    }

    // Action button: Only show "Acionar Garantia" if service is finished and warranty is active
    const renderWarrantyAction = () => {
        if (!isFinished || !hasWarranty || isWarrantyExpired) return null;

        return (
            <TouchableOpacity
                style={styles.fullWidthAction}
                onPress={onPrimaryAction}
                activeOpacity={0.8}
            >
                <ShieldCheck size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.fullWidthActionText}>Acionar Garantia</Text>
            </TouchableOpacity>
        );
    };

    return (
        <TouchableOpacity
            activeOpacity={0.95}
            onPress={onPress}
            style={[styles.container, style]}
        >
            {/* 1. Status Header */}
            <View style={styles.rowHeader}>
                <View style={[styles.statusPill, { backgroundColor: statusConfig.bgColor }]}>
                    <StatusIcon size={12} color={statusConfig.color} />
                    <Text style={[styles.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
                <Text style={styles.orderId}>#{orderIdShort}</Text>
            </View>

            {/* 2. Title Block */}
            <View style={styles.rowTitle}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <Text style={styles.category} numberOfLines={1}>{category}</Text>
            </View>

            {/* 3. Provider Block */}
            <View style={styles.rowProvider}>
                <View style={styles.providerInfo}>
                    <View style={styles.avatarContainer}>
                        {providerImage ? (
                            <Image source={{ uri: providerImage }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>{providerName[0]}</Text>
                            </View>
                        )}
                    </View>
                    <View>
                        <View style={styles.providerNameRow}>
                            <Text style={styles.providerName}>{providerName}</Text>
                            {providerVerified && <ShieldCheck size={14} color={Colors.light.primary} style={{ marginLeft: 4 }} />}
                        </View>
                        <View style={styles.ratingRow}>
                            <Star size={12} color="#F59E0B" fill="#F59E0B" />
                            <Text style={styles.ratingText}>{providerRating}</Text>
                            <Text style={styles.verifiedTag}> • Verificado</Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity style={styles.chatShortcut} onPress={onChatPress}>
                    <MessageCircle size={20} color={Colors.light.primary} />
                </TouchableOpacity>
            </View>

            {/* 4. Operational Row */}
            <View style={styles.rowOperational}>
                <View style={styles.opItem}>
                    <Calendar size={12} color="#94A3B8" />
                    <Text style={styles.opText}>{dateTime}</Text>
                </View>
                <View style={styles.opItem}>
                    <MapPin size={12} color="#94A3B8" />
                    <Text style={styles.opText} numberOfLines={1}>{locationLabel}</Text>
                </View>
                <View style={styles.opItem}>
                    <Text style={styles.priceLabel}>{priceLabel}</Text>
                </View>
            </View>

            {/* 5. Warranty Block */}
            {hasWarranty && (
                <View style={styles.rowWarranty}>
                    <View style={styles.warrantyHeader}>
                        <View style={styles.warrantyTitleContainer}>
                            <ShieldCheck size={14} color={isWarrantyExpired ? '#94A3B8' : Colors.light.success} />
                            <Text style={[styles.warrantyTitle, isWarrantyExpired && { color: '#94A3B8' }]}>
                                {isWarrantyExpired ? 'Garantia encerrada' : isFinished ? 'Garantia ativa' : 'Garantia protegida'}
                            </Text>
                        </View>
                        {isFinished && !isWarrantyExpired && (
                            <Text style={styles.warrantyMeta}>Restam {daysRemaining} dias (de {totalDays})</Text>
                        )}
                    </View>
                    {isFinished ? (
                        <View style={styles.progressContainer}>
                            <View
                                style={[
                                    styles.progressBar,
                                    {
                                        width: `${warrantyProgress * 100}%`,
                                        backgroundColor: isWarrantyExpired ? '#CBD5E1' : Colors.light.success
                                    }
                                ]}
                            />
                        </View>
                    ) : (
                        <Text style={styles.warrantyFuture}>Ativa após a conclusão do serviço</Text>
                    )}
                </View>
            )}

            {!hasWarranty && isFinished && (
                <View style={styles.rowWarranty}>
                    <View style={styles.warrantyHeader}>
                        <View style={styles.warrantyTitleContainer}>
                            <Info size={14} color="#94A3B8" />
                            <Text style={[styles.warrantyTitle, { color: '#94A3B8' }]}>Sem cobertura de garantia</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* 6. Footer Actions: Long dynamic button */}
            {renderWarrantyAction()}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...Layout.shadows.small,
        marginBottom: Layout.spacing.md,
        overflow: 'hidden',
    },
    // Row 1: Header
    rowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        marginBottom: 12,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    orderId: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
    },
    // Row 2: Title
    rowTitle: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 2,
    },
    category: {
        fontSize: 13,
        color: '#64748B',
    },
    // Row 3: Provider
    rowProvider: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.primary,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 1,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#F59E0B',
        marginLeft: 4,
    },
    verifiedTag: {
        fontSize: 11,
        color: '#94A3B8',
    },
    chatShortcut: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Row 4: Operational
    rowOperational: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    opItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    opText: {
        fontSize: 11,
        color: '#64748B',
        marginLeft: 4,
        fontWeight: '500',
    },
    priceLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.light.text,
        textAlign: 'right',
        width: '100%',
    },
    // Row 5: Warranty
    rowWarranty: {
        padding: 16,
    },
    warrantyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    warrantyTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    warrantyTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.light.success,
        marginLeft: 6,
    },
    warrantyMeta: {
        fontSize: 10,
        color: '#94A3B8',
    },
    progressContainer: {
        height: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2,
    },
    warrantyFuture: {
        fontSize: 11,
        color: '#94A3B8',
        fontStyle: 'italic',
    },
    // Row 6: Full Width Action
    fullWidthAction: {
        height: 48,
        backgroundColor: Colors.light.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    fullWidthActionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
