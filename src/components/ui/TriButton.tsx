import { Colors, Layout } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type TriOption = 'true' | 'false' | 'unknown';

interface TriButtonProps {
    value?: TriOption;
    onChange: (value: TriOption) => void;
}

export const TriButton = ({ value, onChange }: TriButtonProps) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[styles.btn, value === 'true' && styles.btnYes]}
                onPress={() => onChange('true')}
            >
                <Text style={[styles.label, value === 'true' && styles.labelSelected]}>Sim</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.btn, value === 'false' && styles.btnNo]}
                onPress={() => onChange('false')}
            >
                <Text style={[styles.label, value === 'false' && styles.labelSelected]}>Não</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.btn, value === 'unknown' && styles.btnUnknown]}
                onPress={() => onChange('unknown')}
            >
                <Text style={[styles.label, value === 'unknown' && styles.labelSelected]}>Não sei</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'column',
        gap: 12,
        width: '100%',
    },
    btn: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#f0f0f0',
        alignItems: 'center',
        ...Layout.shadows.small,
    },
    label: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
    },
    labelSelected: {
        color: '#fff',
    },
    btnYes: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    btnNo: {
        backgroundColor: '#EF4444', // Red
        borderColor: '#EF4444',
    },
    btnUnknown: {
        backgroundColor: '#9CA3AF', // Gray
        borderColor: '#9CA3AF',
    },
});
