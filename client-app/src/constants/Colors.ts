/**
 * ============================================
 * SISTEMA DE CORES DO APLICATIVO
 * ============================================
 * 
 * Este arquivo define todas as cores usadas no app.
 * 
 * COMO USAR:
 * - Importe: import { Colors } from '@/constants/Colors';
 * - Use: Colors.light.primary (cor primária)
 * 
 * O QUE PODE ALTERAR:
 * - Todas as cores abaixo podem ser mudadas
 * - Use códigos hex (#FF0000) ou nomes ('red')
 * - Para encontrar cores: https://coolors.co ou Google "color picker"
 * 
 * ESTRUTURA:
 * - Colors.light = cores para modo claro
 * - Colors.dark = cores para modo escuro (futuro)
 * - Layout = espaçamentos, raios, sombras
 */

/**
 * CORES BASE DA MARCA
 * 
 * Estas são as cores principais do app.
 * PODE ALTERAR: mude os valores hex (#FD7B05) para suas cores
 * 
 * Formato de cor:
 * - Hex: '#FD7B05' (mais comum)
 * - RGB: 'rgb(253, 123, 5)'
 * - Nome: 'orange' (limitado)
 */
const harvestOrange = '#ff7b00ff';    // Laranja principal (cor primária)
const schoolBusYellow = '#FEC52E';  // Amarelo (cor secundária)
const chartreuse = '#9fd211ff';        // Verde claro (cor de sucesso)
const white = '#FFFFFF';             // Branco
const ebony = '#5B6A57';             // Verde escuro (texto secundário)

// Cores de destaque (tint) para modo claro e escuro
const tintColorLight = harvestOrange;  // Cor de destaque no modo claro
const tintColorDark = white;            // Cor de destaque no modo escuro

/**
 * OBJETO PRINCIPAL DE CORES
 * 
 * Todas as cores do app estão aqui organizadas por categoria.
 * 
 * COMO ALTERAR CORES:
 * 1. Encontre a cor que quer mudar (ex: primary)
 * 2. Mude o valor (ex: '#FF0000' para vermelho)
 * 3. Salve o arquivo
 * 4. O app atualiza automaticamente
 */
export const Colors = {
    // Modo claro (usado atualmente)
    light: {
        // CORES DE TEXTO
        text: '#363739ff',                 // Texto principal (cinza escuro premium) - não usar preto puro
        textSecondary: ebony,            // Texto secundário (verde escuro)

        // CORES DE FUNDO
        background: '#F2F4F8',           // Fundo da tela (cinza claro)
        tint: tintColorLight,            // Cor de destaque (laranja)

        // CORES DE ÍCONES DE ABA
        tabIconDefault: '#ccc',          // Ícone não selecionado (cinza)
        tabIconSelected: tintColorLight, // Ícone selecionado (laranja)

        // CORES DA MARCA
        primary: harvestOrange,          // Cor primária (laranja) - USADA EM BOTÕES PRINCIPAIS
        primaryGradientStart: harvestOrange, // Início do gradiente
        primaryGradientEnd: schoolBusYellow, // Fim do gradiente
        secondary: schoolBusYellow,       // Cor secundária (amarelo)
        accent: chartreuse,              // Cor de destaque (verde claro)

        // CORES DE STATUS
        // success: cor de sucesso (verde)
        success: chartreuse,              // Verde claro para sucesso
        successBackground: '#F0F9E6',    // Fundo verde claro (para cards de sucesso)

        // warning: cor de aviso (amarelo)
        warning: schoolBusYellow,        // Amarelo para avisos
        warningBackground: '#FFF9E5',    // Fundo amarelo claro

        // danger: cor de erro (vermelho)
        danger: '#FF3B30',               // Vermelho para erros (padrão iOS)

        // CORES DE UI (Interface)
        card: white,                     // Fundo de cards (branco)
        border: '#E5E5EA',               // Cor de bordas (cinza claro)
        glass: 'rgba(255, 255, 255, 0.9)', // Efeito de vidro (branco semi-transparente)
        shadow: '#000000',                // Cor de sombras (preto)
    },
    // Modo escuro (para implementação futura)
    // Por enquanto não está sendo usado, mas está preparado
    dark: {
        text: white,                      // Texto claro no modo escuro
        textSecondary: '#AAAAAA',         // Texto secundário (cinza claro)
        background: '#000',               // Fundo preto
        tint: tintColorDark,              // Destaque branco
        tabIconDefault: '#ccc',
        tabIconSelected: tintColorDark,
        primary: harvestOrange,          // Mantém laranja mesmo no escuro
        secondary: schoolBusYellow,
        accent: chartreuse,
        success: chartreuse,
        successBackground: '#1A2E05',    // Fundo verde escuro
        warning: schoolBusYellow,
        warningBackground: '#3F2600',    // Fundo amarelo escuro
        danger: '#FF453A',                // Vermelho mais claro
        card: '#1C1C1E',                  // Card escuro
        border: '#38383A',                // Borda escura
        glass: 'rgba(30, 30, 30, 0.8)',  // Vidro escuro
        shadow: '#000000',
    },
};

/**
 * ============================================
 * SISTEMA DE LAYOUT (ESPAÇAMENTOS E FORMAS)
 * ============================================
 * 
 * Define espaçamentos, raios de borda e sombras padronizados.
 * 
 * COMO USAR:
 * - Importe: import { Layout } from '@/constants/Colors';
 * - Use: Layout.spacing.lg (24px de espaçamento)
 * 
 * VANTAGENS:
 * - Consistência visual
 * - Fácil de alterar globalmente
 * - Código mais limpo
 */
export const Layout = {
    // ESPAÇAMENTOS (padding, margin)
    // Use estes valores em vez de números aleatórios
    spacing: {
        xs: 4,    // Extra pequeno (4px)
        sm: 8,    // Pequeno (8px)
        md: 16,   // Médio (16px)
        lg: 24,   // Grande (24px)
        xl: 32,   // Extra grande (32px)
        xxl: 40,  // Extra extra grande (40px)
    },

    // RAIOS DE BORDA (borderRadius)
    // Define quão arredondadas são as bordas
    radius: {
        sm: 8,     // Pequeno (8px) - cards pequenos
        md: 12,    // Médio (12px) - cards médios
        lg: 16,    // Grande (16px) - cards grandes
        xl: 24,    // Extra grande (24px) - modais
        xxl: 32,   // Extra extra grande (32px)
        round: 9999, // Totalmente redondo (círculos)
    },

    // SOMBRAS (shadow)
    // Cria efeito de profundidade/elevação
    shadows: {
        // Sombra pequena (cards simples)
        small: {
            shadowColor: "#000",              // Cor da sombra (preto)
            shadowOffset: { width: 0, height: 2 }, // Deslocamento (2px para baixo)
            shadowOpacity: 0.1,               // Opacidade (10% - bem sutil)
            shadowRadius: 3,                 // Desfoque (3px)
            elevation: 2,                     // Android (equivalente)
        },
        // Sombra média (cards destacados)
        medium: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 }, // 4px para baixo
            shadowOpacity: 0.15,            // 15% de opacidade
            shadowRadius: 6,                 // 6px de desfoque
            elevation: 4,                    // Android
        },
        // Sombra grande (modais, elementos flutuantes)
        large: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 }, // 8px para baixo
            shadowOpacity: 0.2,              // 20% de opacidade
            shadowRadius: 12,               // 12px de desfoque
            elevation: 8,                    // Android
        },
    }
};
