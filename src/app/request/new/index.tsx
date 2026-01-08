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
import { CATEGORIES } from '@/services/mockData';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SelectCategoryScreen() {
    // ============================================
    // HOOKS E VARIÁVEIS
    // ============================================

    // router: usado para navegar entre telas
    // router.push() = vai para outra tela
    // router.back() = volta para tela anterior
    const router = useRouter();

    // params: parâmetros passados pela tela anterior
    // Exemplo: /request/new?mode=instant
    // params.mode = 'instant'
    const params = useLocalSearchParams();

    // mode: tipo de serviço escolhido na home
    // 'instant' = Reparo rápido
    // 'evaluation' = Precisa avaliar
    // 'workshop' = Levar para oficina
    // Se não vier parâmetro, usa 'instant' como padrão
    const mode = (params.mode as string) || 'instant';

    // startDraft: função do contexto para iniciar rascunho
    // Vem de RequestContext (veja src/context/RequestContext.tsx)
    const { startDraft } = useRequest();

    /**
     * Função chamada quando usuário clica em uma categoria
     * 
     * Parâmetro:
     * - category: ID da categoria (ex: 'electronics', 'agro')
     * 
     * O QUE FAZ:
     * 1. Inicia rascunho no contexto (salva categoria e tipo de serviço)
     * 2. Navega para tela de localização
     * 
     * PODE ALTERAR:
     * - Adicione validações antes de navegar
     * - Adicione animação ou feedback visual
     * - Mude o destino (pathname) se quiser ir para outra tela
     */
    const handleSelect = (category: string) => {
        // Salva no contexto: categoria e tipo de serviço
        startDraft(category, mode as 'instant' | 'evaluation' | 'workshop');

        // Vai diretamente para tela de detalhes, pois a localização agora é tratada lá
        router.push({
            pathname: '/request/new/details',  // Caminho da próxima tela
            params: { category, mode }          // Dados passados para próxima tela
        });
    };

    /**
     * Função que renderiza cada item da lista de categorias
     * 
     * Parâmetro:
     * - item: uma categoria do array CATEGORIES
     * 
     * O QUE FAZ:
     * 1. Verifica se categoria suporta o tipo de serviço escolhido
     * 2. Se não suportar, não mostra (return null)
     * 3. Se suportar, mostra card clicável
     * 
     * PODE ALTERAR:
     * - Layout do card (tamanho, cores, espaçamento)
     * - Adicione animação ao tocar
     * - Adicione mais informações no card
     */
    const renderItem = ({ item }: { item: typeof CATEGORIES[0] }) => {
        // Verifica se esta categoria suporta o tipo de serviço escolhido
        // Exemplo: se mode='instant', só mostra categorias que têm 'instant' em tracks
        const supportsTrack = item.tracks?.includes(mode as any);

        // Se não suportar, não renderiza nada
        if (!supportsTrack) return null;

        return (
            <TouchableOpacity onPress={() => handleSelect(item.id)} style={styles.gridItem}>
                <Card style={styles.card} padding={16}>
                    <View style={styles.iconWrapper}>
                        <Image source={item.icon} style={styles.iconImage} resizeMode="contain" />
                    </View>
                    <Text style={styles.label}>{item.name}</Text>
                    {item.description && (
                        <Text style={styles.description}>{item.description}</Text>
                    )}
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Novo Pedido</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {/* TÍTULO E SUBTÍTULO - PODE ALTERAR OS TEXTOS */}
                <Text style={styles.title}>Do que você precisa?</Text>
                <Text style={styles.subtitle}>Escolha uma categoria para começar</Text>

                {/* LISTA DE CATEGORIAS */}
                {/* FlatList: componente que renderiza lista otimizada */}
                <FlatList
                    data={CATEGORIES}                    // Dados: vem de mockData.ts
                    renderItem={renderItem}              // Função que renderiza cada item
                    keyExtractor={item => item.id}       // Chave única de cada item
                    numColumns={2}                       // Grid de 2 colunas (pode mudar para 3)
                    contentContainerStyle={styles.list}  // Estilo do container
                    showsVerticalScrollIndicator={false} // Esconde barra de rolagem
                />
            </View>
        </View>
    );
}

/**
 * ============================================
 * ESTILOS (STYLES)
 * ============================================
 * 
 * Define como os elementos aparecem na tela.
 * 
 * PROPRIEDADES COMUNS:
 * - flex: 1 = ocupa todo espaço disponível
 * - backgroundColor: cor de fundo
 * - padding: espaçamento interno
 * - margin: espaçamento externo
 * - fontSize: tamanho da fonte
 * - fontWeight: 'bold' = negrito, 'normal' = normal
 * - color: cor do texto
 * - borderRadius: arredondamento das bordas
 * 
 * CORES:
 * - Vêm de Colors.light (veja src/constants/Colors.ts)
 * - Pode usar cores diretas: '#FF0000' (vermelho)
 * 
 * ESPAÇAMENTOS:
 * - Vêm de Layout.spacing (veja src/constants/Colors.ts)
 * - Ou use números diretos: 10, 20, etc.
 */
const styles = StyleSheet.create({
    // Container principal (tela inteira)
    container: {
        flex: 1,                              // Ocupa toda altura disponível
        backgroundColor: Colors.light.background,  // Cor de fundo (vem de Colors.ts)
    },
    // Cabeçalho da tela (barra superior)
    header: {
        flexDirection: 'row',              // Elementos em linha (horizontal)
        alignItems: 'center',              // Alinha verticalmente ao centro
        justifyContent: 'space-between',   // Espaça elementos (esquerda, centro, direita)
        paddingHorizontal: 20,             // Espaçamento lateral (esquerda/direita)
        paddingVertical: 16,                // Espaçamento vertical (cima/baixo)
        backgroundColor: '#fff',           // Fundo branco (pode mudar)
        borderBottomWidth: 1,               // Espessura da borda inferior
        borderBottomColor: '#f0f0f0',      // Cor da borda (cinza claro)
    },
    // Botão de voltar (seta ←)
    backButton: {
        padding: 4,                        // Espaçamento interno (área clicável)
    },
    // Texto do botão voltar
    backButtonText: {
        fontSize: 24,                      // Tamanho da fonte (pode mudar)
        color: Colors.light.text,          // Cor do texto (vem de Colors.ts)
    },
    // Título do cabeçalho
    headerTitle: {
        fontSize: 18,                      // Tamanho da fonte
        fontWeight: 'bold',                // Negrito
        color: Colors.light.text,         // Cor do texto
    },
    // Área de conteúdo (abaixo do cabeçalho)
    content: {
        flex: 1,                           // Ocupa espaço restante
        padding: Layout.spacing.lg,        // Espaçamento interno (24px)
        paddingTop: 24,                     // Espaçamento superior extra
    },
    // Título principal
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: Layout.spacing.xs,
    },
    // Subtítulo
    subtitle: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        marginBottom: Layout.spacing.xl,
    },
    // Container da lista
    list: {
        paddingBottom: Layout.spacing.xl,
    },
    // Item do grid (cada card de categoria)
    gridItem: {
        flex: 1,
        margin: Layout.spacing.sm,
    },
    // Card de categoria
    card: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 140,
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        backgroundColor: '#fff',
        ...Layout.shadows.small,
    },
    // Container do ícone
    iconWrapper: {
        width: 60,                         // Largura do ícone
        height: 60,                         // Altura do ícone
        marginBottom: 12,                   // Espaço abaixo do ícone
        alignItems: 'center',              // Centraliza horizontalmente
        justifyContent: 'center',          // Centraliza verticalmente
    },
    // Imagem do ícone
    iconImage: {
        width: '100%',                     // Largura 100% do container
        height: '100%',                     // Altura 100% do container
    },
    // Nome da categoria
    label: {
        fontSize: 14,                       // Tamanho da fonte
        fontWeight: '600',                  // Semi-negrito (pode ser 'bold', 'normal')
        color: Colors.light.text,          // Cor do texto
        textAlign: 'center',               // Texto centralizado
    },
    // Descrição da categoria
    description: {
        fontSize: 11,                      // Fonte pequena
        color: Colors.light.textSecondary, // Cor secundária
        textAlign: 'center',               // Centralizado
        marginTop: 4,                      // Espaço acima
    }
});
