import { Colors } from '@/constants/Colors';
import { ProviderFilters as ProviderFiltersType } from '@/types';
import { Filter, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CATEGORIES } from '@/services/mockData';

interface ProviderFiltersProps {
    filters: ProviderFiltersType;
    onFiltersChange: (filters: ProviderFiltersType) => void;
}

export function ProviderFilters({ filters, onFiltersChange }: ProviderFiltersProps) {
    const [showModal, setShowModal] = useState(false);
    const [localFilters, setLocalFilters] = useState<ProviderFiltersType>(filters);

    const activeFiltersCount = Object.values(filters).filter(v => v !== undefined).length;

    const applyFilters = () => {
        onFiltersChange(localFilters);
        setShowModal(false);
    };

    const resetFilters = () => {
        const empty: ProviderFiltersType = {};
        setLocalFilters(empty);
        onFiltersChange(empty);
        setShowModal(false);
    };

    return (
        <>
            <TouchableOpacity 
                style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
                onPress={() => setShowModal(true)}
            >
                <Filter size={18} color={activeFiltersCount > 0 ? '#fff' : Colors.light.primary} />
                {activeFiltersCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{activeFiltersCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filtros</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <X size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Online Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Status</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.filterOption,
                                        localFilters.online === true && styles.filterOptionActive
                                    ]}
                                    onPress={() => setLocalFilters({ ...localFilters, online: localFilters.online === true ? undefined : true })}
                                >
                                    <View style={[styles.checkbox, localFilters.online === true && styles.checkboxActive]} />
                                    <Text style={styles.filterOptionText}>Apenas online</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Verified Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Verificação</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.filterOption,
                                        localFilters.verified === true && styles.filterOptionActive
                                    ]}
                                    onPress={() => setLocalFilters({ ...localFilters, verified: localFilters.verified === true ? undefined : true })}
                                >
                                    <View style={[styles.checkbox, localFilters.verified === true && styles.checkboxActive]} />
                                    <Text style={styles.filterOptionText}>Apenas verificados</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Category Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Categoria</Text>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.filterOption,
                                            localFilters.category === cat.id && styles.filterOptionActive
                                        ]}
                                        onPress={() => setLocalFilters({ 
                                            ...localFilters, 
                                            category: localFilters.category === cat.id ? undefined : cat.id 
                                        })}
                                    >
                                        <View style={[styles.checkbox, localFilters.category === cat.id && styles.checkboxActive]} />
                                        <Text style={styles.filterOptionText}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Distance Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Distância Máxima</Text>
                                {[5, 10, 20, 50].map(km => (
                                    <TouchableOpacity
                                        key={km}
                                        style={[
                                            styles.filterOption,
                                            localFilters.maxDistance === km && styles.filterOptionActive
                                        ]}
                                        onPress={() => setLocalFilters({ 
                                            ...localFilters, 
                                            maxDistance: localFilters.maxDistance === km ? undefined : km 
                                        })}
                                    >
                                        <View style={[styles.checkbox, localFilters.maxDistance === km && styles.checkboxActive]} />
                                        <Text style={styles.filterOptionText}>Até {km} km</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Rating Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Avaliação Mínima</Text>
                                {[3.0, 3.5, 4.0, 4.5, 5.0].map(rating => (
                                    <TouchableOpacity
                                        key={rating}
                                        style={[
                                            styles.filterOption,
                                            localFilters.minRating === rating && styles.filterOptionActive
                                        ]}
                                        onPress={() => setLocalFilters({ 
                                            ...localFilters, 
                                            minRating: localFilters.minRating === rating ? undefined : rating 
                                        })}
                                    >
                                        <View style={[styles.checkbox, localFilters.minRating === rating && styles.checkboxActive]} />
                                        <Text style={styles.filterOptionText}>{rating} ⭐ ou mais</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                                <Text style={styles.resetButtonText}>Limpar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                                <Text style={styles.applyButtonText}>Aplicar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.light.primary,
        backgroundColor: '#fff',
    },
    filterButtonActive: {
        backgroundColor: Colors.light.primary,
    },
    badge: {
        marginLeft: 6,
        backgroundColor: '#fff',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Colors.light.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    modalBody: {
        padding: 20,
    },
    filterSection: {
        marginBottom: 24,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 12,
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    filterOptionActive: {
        backgroundColor: '#F0F9E6',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#ddd',
        marginRight: 12,
    },
    checkboxActive: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    filterOptionText: {
        fontSize: 14,
        color: Colors.light.text,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        gap: 12,
    },
    resetButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

