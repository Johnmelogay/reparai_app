import { useLocation } from '@/context/LocationContext';
import { SavedAddress } from '@/types';
import { Briefcase, Home, MapPin } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface SavedAddressesListProps {
    onAddPress?: () => void;
}

export default function SavedAddressesList({ onAddPress }: SavedAddressesListProps) {
    const { savedAddresses, selectLocation, selectedLocation } = useLocation();

    const getIcon = (iconName: string) => {
        switch (iconName) {
            case 'Home': return <Home size={16} color="#4B5563" />;
            case 'Briefcase': return <Briefcase size={16} color="#4B5563" />;
            default: return <MapPin size={16} color="#4B5563" />;
        }
    };

    const handleSelect = (addr: SavedAddress) => {
        selectLocation(
            addr.latitude,
            addr.longitude,
            addr.address,
            {
                streetNumber: addr.streetNumber,
                neighborhood: addr.neighborhood,
                city: addr.city,
                state: addr.state
            }
        );
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {savedAddresses.map((addr) => {
                const isSelected = selectedLocation?.latitude === addr.latitude && selectedLocation?.longitude === addr.longitude;
                return (
                    <TouchableOpacity
                        key={addr.id}
                        style={[styles.chip, isSelected && styles.selectedChip]}
                        onPress={() => handleSelect(addr)}
                    >
                        {getIcon(addr.icon)}
                        <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>{addr.name}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
        paddingHorizontal: 16, // Match parent padding usually
        gap: 8,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E6F4EA', // Light green bg
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
        borderWidth: 1,
        borderColor: '#00A36C',
    },
    addButtonText: {
        color: '#00A36C',
        fontSize: 12,
        fontWeight: '600',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    selectedChip: {
        backgroundColor: '#F0FDF4',
        borderColor: '#00A36C',
    },
    chipText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    selectedChipText: {
        color: '#00A36C',
    },
});
