import { Colors } from '@/constants/Colors';
import { ProviderBadge } from '@/types';
import { CheckCircle, Shield, Star, Zap } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BadgeProps {
    badge: ProviderBadge;
    size?: 'sm' | 'md' | 'lg';
}

const badgeConfig = {
    registered: {
        label: 'Cadastrado',
        icon: CheckCircle,
        color: '#6B7280',
        bg: '#F3F4F6',
    },
    verified: {
        label: 'Verificado',
        icon: Shield,
        color: '#3B82F6',
        bg: '#DBEAFE',
    },
    professional: {
        label: 'Profissional',
        icon: Star,
        color: '#F59E0B',
        bg: '#FEF3C7',
    },
    featured: {
        label: 'Destaque',
        icon: Zap,
        color: Colors.light.primary,
        bg: Colors.light.successBackground,
    },
};

export function Badge({ badge, size = 'md' }: BadgeProps) {
    const config = badgeConfig[badge];
    const Icon = config.icon;

    const sizeStyles = {
        sm: { padding: 4, fontSize: 10, iconSize: 12 },
        md: { padding: 6, fontSize: 11, iconSize: 14 },
        lg: { padding: 8, fontSize: 12, iconSize: 16 },
    };

    const currentSize = sizeStyles[size];

    return (
        <View style={[styles.container, { backgroundColor: config.bg, paddingHorizontal: currentSize.padding, paddingVertical: currentSize.padding / 2 }]}>
            <Icon size={currentSize.iconSize} color={config.color} />
            <Text style={[styles.label, { color: config.color, fontSize: currentSize.fontSize }]}>
                {config.label}
            </Text>
        </View>
    );
}

interface BadgeListProps {
    badges: ProviderBadge[];
    size?: 'sm' | 'md' | 'lg';
}

export function BadgeList({ badges, size = 'md' }: BadgeListProps) {
    return (
        <View style={styles.list}>
            {badges.map((badge, index) => (
                <Badge key={index} badge={badge} size={size} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        marginRight: 6,
        marginBottom: 6,
    },
    label: {
        marginLeft: 4,
        fontWeight: '600',
    },
    list: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
});

