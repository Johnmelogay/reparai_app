import { Colors } from '@/constants/Colors';
import { Warranty } from '@/types';
import { Shield } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WarrantyCardProps {
    warranty: Warranty;
    onActivate?: () => void;
}

export function WarrantyCard({ warranty, onActivate }: WarrantyCardProps) {
    const now = new Date().getTime();
    const expiresAt = new Date(warranty.expiresAt).getTime();
    const activatedAt = new Date(warranty.activatedAt).getTime();
    const total = expiresAt - activatedAt;
    const elapsed = now - activatedAt;
    const progress = Math.max(0, Math.min(1, elapsed / total));
    const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    const isExpired = daysRemaining <= 0;
    const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

    return (
        <View style={[styles.container, isExpired && styles.expired]}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Shield size={20} color={isExpired ? '#999' : Colors.light.primary} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Garantia do Serviço</Text>
                    <Text style={[styles.subtitle, isExpired && styles.expiredText]}>
                        {isExpired 
                            ? 'Expirada' 
                            : isExpiringSoon 
                            ? `Expira em ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''}`
                            : `Válida até ${new Date(warranty.expiresAt).toLocaleDateString('pt-BR')}`}
                    </Text>
                </View>
            </View>

            {!isExpired && (
                <>
                    <View style={styles.progressBar}>
                        <View 
                            style={[
                                styles.progressFill, 
                                { width: `${(1 - progress) * 100}%` },
                                isExpiringSoon && styles.progressExpiring
                            ]} 
                        />
                    </View>

                    {onActivate && (
                        <TouchableOpacity 
                            style={styles.activateButton}
                            onPress={onActivate}
                        >
                            <Text style={styles.activateText}>Acionar Garantia</Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F0F9E6',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.light.success,
    },
    expired: {
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    expiredText: {
        color: '#999',
    },
    progressBar: {
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.light.primary,
        borderRadius: 3,
    },
    progressExpiring: {
        backgroundColor: '#F59E0B',
    },
    activateButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.light.primary,
        alignItems: 'center',
    },
    activateText: {
        color: Colors.light.primary,
        fontWeight: '600',
        fontSize: 14,
    },
});

