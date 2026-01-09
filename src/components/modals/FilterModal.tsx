import { Colors } from '@/constants/Colors';
import { Star, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

export interface FilterState {
    sortBy: 'nearest' | 'rating' | 'price_asc' | 'price_desc';
    maxDistance: number; // in km
    minRating: number;
}

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    currentFilters: FilterState;
}

const SORT_OPTIONS = [
    { id: 'nearest', label: 'Mais Próximos' },
    { id: 'rating', label: 'Melhor Avaliação' },
    { id: 'price_asc', label: 'Menor Preço' },
];

const DISTANCE_OPTIONS = [5, 10, 20, 50, 100];

export const FilterModal = ({ visible, onClose, onApply, currentFilters }: FilterModalProps) => {
    const [filters, setFilters] = useState<FilterState>(currentFilters);

    useEffect(() => {
        if (visible) {
            setFilters(currentFilters);
        }
    }, [visible, currentFilters]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        const defaultFilters: FilterState = {
            sortBy: 'nearest',
            maxDistance: 20,
            minRating: 0
        };
        setFilters(defaultFilters);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.sheet}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.title}>Filtros e Ordenação</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <View style={styles.closeBtn}>
                                        <X size={20} color="#666" />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.content}>
                                {/* Sort By */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Ordenar por</Text>
                                    <View style={styles.chipsRow}>
                                        {SORT_OPTIONS.map(opt => (
                                            <TouchableOpacity
                                                key={opt.id}
                                                style={[
                                                    styles.chip,
                                                    filters.sortBy === opt.id && styles.chipActive
                                                ]}
                                                onPress={() => setFilters(prev => ({ ...prev, sortBy: opt.id as any }))}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    filters.sortBy === opt.id && styles.chipTextActive
                                                ]}>
                                                    {opt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Max Distance */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Distância Máxima</Text>
                                    <View style={styles.chipsRow}>
                                        {DISTANCE_OPTIONS.map(dist => (
                                            <TouchableOpacity
                                                key={dist}
                                                style={[
                                                    styles.chip,
                                                    filters.maxDistance === dist && styles.chipActive
                                                ]}
                                                onPress={() => setFilters(prev => ({ ...prev, maxDistance: dist }))}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    filters.maxDistance === dist && styles.chipTextActive
                                                ]}>
                                                    {dist === 100 ? '100km+' : `${dist}km`}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Min Rating */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Avaliação Mínima</Text>
                                    <View style={styles.chipsRow}>
                                        {[4, 4.5, 4.8].map((rating) => (
                                            <TouchableOpacity
                                                key={rating}
                                                style={[
                                                    styles.chip,
                                                    filters.minRating === rating && styles.chipActive
                                                ]}
                                                onPress={() => setFilters(prev => ({
                                                    ...prev,
                                                    minRating: prev.minRating === rating ? 0 : rating // Toggle
                                                }))}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={[
                                                        styles.chipText,
                                                        filters.minRating === rating && styles.chipTextActive
                                                    ]}>
                                                        {rating.toFixed(1)}+
                                                    </Text>
                                                    <Star
                                                        size={12}
                                                        color={filters.minRating === rating ? '#fff' : '#F59E0B'}
                                                        fill={filters.minRating === rating ? '#fff' : '#F59E0B'}
                                                        style={{ marginLeft: 4 }}
                                                    />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </ScrollView>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                                    <Text style={styles.resetText}>Limpar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                                    <Text style={styles.applyText}>Aplicar Filtros</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 30,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
    },
    closeBtn: {
        padding: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
    },
    content: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginRight: 10,
        marginBottom: 10,
    },
    chipActive: {
        backgroundColor: '#111',
        borderColor: '#111',
    },
    chipText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        alignItems: 'center',
    },
    resetButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    resetText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    applyButton: {
        flex: 1,
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginLeft: 10,
    },
    applyText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
