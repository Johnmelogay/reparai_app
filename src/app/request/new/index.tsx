/**
 * ============================================
 * TELA: SELEÇÃO DE CATEGORIA
 * ============================================
 * 
 * Esta tela mostra as categorias de serviço disponíveis
 * e permite ao usuário escolher qual categoria precisa.
 * 
 * FLUXO:
 * 1. Usuário escolhe tipo de serviço na home (instant/evaluation/workshop)
 * 2. Chega nesta tela para escolher categoria
 * 3. Ao selecionar, vai para tela de localização
 * 
 * O QUE PODE ALTERAR:
 * - Textos (título, subtítulo)
 * - Layout (grid de 2 colunas, pode mudar para 3)
 * - Estilos (cores, tamanhos, espaçamentos)
 * - Adicionar filtros ou busca
 */

import { Card } from '@/components/ui/Card';
import { Colors, Layout } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { DOMAINS } from '@/services/mockData';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SelectCategoryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const mode = (params.mode as string) || 'instant';
    const { startDraft } = useRequest();

    const handleSelect = (domainSlug: string) => {
        // Start draft with domain slug instead of category
        startDraft(domainSlug, mode as 'instant' | 'evaluation' | 'workshop');
        router.push({
            pathname: '/request/new/describe',
            params: { category: domainSlug, mode } // Keep 'category' param for compatibility
        });
    };

    const renderItem = ({ item }: { item: typeof DOMAINS[0] }) => {
        const supportsTrack = item.tracks?.includes(mode as any);
        if (!supportsTrack) return null;

        return (
            <TouchableOpacity onPress={() => handleSelect(item.slug)} style={styles.gridItem}>
                <Card style={styles.card} padding={15}>
                    <View style={styles.iconWrapper}>
                        <Image source={item.icon} style={styles.iconImage} resizeMode="contain" />
                    </View>
                    <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>{item.name}</Text>
                    {/* Description removed for compact grid */}
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Novo Pedido</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>Do que você precisa?</Text>
                <Text style={styles.subtitle}>Escolha um domínio</Text>

                <FlatList
                    data={DOMAINS}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15, // Reduced padding bottom since SafeArea handles top
        paddingTop: 10,
        backgroundColor: Colors.light.background, // Match bg to avoid hard cut
    },
    backButton: { padding: 4 },
    backButtonText: { fontSize: 24, color: Colors.light.text },
    headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
    content: { flex: 1, paddingHorizontal: 20 },
    title: {
        fontSize: 24, // Smaller title
        fontWeight: '900',
        color: Colors.light.text,
        marginBottom: 4,
        letterSpacing: -0.5,
        marginTop: 10
    },
    subtitle: {
        fontSize: 16, // Smaller subtitle
        color: Colors.light.textSecondary,
        marginBottom: 20,
    },
    list: { paddingBottom: 40 },
    columnWrapper: { justifyContent: 'space-between', gap: 15 },
    gridItem: {
        width: '48%', // Flexible width for 2 columns with gap
        marginBottom: 15,
    },
    card: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 140, // Fixed compact height
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        ...Layout.shadows.small,
    },
    iconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: '#F8F9FA',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    iconImage: { width: 32, height: 32 },
    label: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.light.text,
        textAlign: 'center',
    },
});
