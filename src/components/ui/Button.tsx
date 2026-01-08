/**
 * ============================================
 * COMPONENTE: BOTÃO (BUTTON)
 * ============================================
 * 
 * Componente reutilizável de botão usado em todo o app.
 * 
 * COMO USAR:
 * ```tsx
 * <Button 
 *     title="Clique aqui"
 *     onPress={() => console.log('clicou')}
 *     variant="primary"
 * />
 * ```
 * 
 * PROPRIEDADES (PROPS):
 * - title: texto do botão (obrigatório)
 * - onPress: função chamada ao clicar (obrigatório)
 * - variant: estilo do botão (opcional, padrão: 'primary')
 * - size: tamanho (opcional, padrão: 'md')
 * - loading: mostra loading (opcional, padrão: false)
 * - disabled: desabilita botão (opcional, padrão: false)
 * - leftIcon: ícone à esquerda (opcional)
 * - style: estilos adicionais (opcional)
 * 
 * O QUE PODE ALTERAR:
 * - Cores dos variants
 * - Tamanhos (sm, md, lg)
 * - Adicionar novos variants
 * - Adicionar rightIcon
 */

import { Colors, Layout } from '@/constants/Colors';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { GlassView } from './GlassView';

/**
 * Interface que define as propriedades do botão
 * 
 * Todas as propriedades são opcionais exceto title e onPress
 */
interface ButtonProps {
    title: string;              // Texto do botão (obrigatório)
    onPress: () => void;        // Função chamada ao clicar (obrigatório)
    
    // Variantes de estilo:
    // 'primary' = botão principal (laranja)
    // 'secondary' = botão secundário (amarelo)
    // 'glass' = efeito de vidro
    // 'outline' = apenas borda (sem preenchimento)
    // 'ghost' = transparente (sem borda)
    variant?: 'primary' | 'secondary' | 'glass' | 'outline' | 'ghost';
    
    // Tamanhos:
    // 'sm' = pequeno (32px de altura)
    // 'md' = médio (48px de altura) - padrão
    // 'lg' = grande (56px de altura)
    size?: 'sm' | 'md' | 'lg';
    
    loading?: boolean;          // Se true, mostra spinner de loading
    disabled?: boolean;         // Se true, desabilita o botão
    leftIcon?: React.ReactNode; // Ícone à esquerda do texto
    style?: ViewStyle;          // Estilos adicionais (opcional)
}

/**
 * Componente Button
 * 
 * Renderiza um botão com diferentes estilos e tamanhos.
 * 
 * PODE ALTERAR:
 * - Cores de cada variant (getBackgroundColor)
 * - Cores de texto (getTextColor)
 * - Alturas dos tamanhos (getHeight)
 * - Adicione novos variants se necessário
 */
export function Button({
    title,
    onPress,
    variant = 'primary',    // Padrão: botão principal
    size = 'md',            // Padrão: tamanho médio
    loading = false,        // Padrão: sem loading
    disabled = false,       // Padrão: habilitado
    leftIcon,
    style
}: ButtonProps) {

    /**
     * Retorna a cor de fundo baseado no variant
     * 
     * PODE ALTERAR:
     * - Mude as cores retornadas
     * - Adicione novos cases para novos variants
     * - Mude a cor quando disabled
     */
    const getBackgroundColor = () => {
        // Se desabilitado, sempre cinza
        if (disabled) return '#CCC';
        
        // Retorna cor baseado no variant
        switch (variant) {
            case 'primary': return Colors.light.primary;      // Laranja
            case 'secondary': return Colors.light.secondary;   // Amarelo
            case 'outline': return 'transparent';             // Transparente (só borda)
            case 'ghost': return 'transparent';                // Transparente (sem borda)
            case 'glass': return 'transparent';                // Transparente (efeito vidro)
            default: return Colors.light.primary;              // Padrão: laranja
        }
    };

    /**
     * Retorna a cor do texto baseado no variant
     * 
     * PODE ALTERAR:
     * - Mude as cores do texto
     * - Ajuste para melhor contraste
     */
    const getTextColor = () => {
        // Se desabilitado, texto cinza
        if (disabled) return '#888';
        
        switch (variant) {
            case 'primary': return '#FFFFFF';              // Branco (sobre laranja)
            case 'secondary': return '#FFFFFF';            // Branco (sobre amarelo)
            case 'outline': return Colors.light.primary;    // Laranja (sobre transparente)
            case 'ghost': return Colors.light.text;         // Texto normal (sobre transparente)
            case 'glass': return Colors.light.text;         // Texto normal (sobre vidro)
            default: return '#FFFFFF';                      // Padrão: branco
        }
    };

    /**
     * Retorna a altura do botão baseado no size
     * 
     * PODE ALTERAR:
     * - Mude os valores de altura (32, 48, 56)
     * - Adicione novos tamanhos (ex: 'xl': 64)
     */
    const getHeight = () => {
        switch (size) {
            case 'sm': return 32;  // Pequeno: 32px
            case 'md': return 48;  // Médio: 48px (padrão)
            case 'lg': return 56;  // Grande: 56px
            default: return 48;   // Padrão: 48px
        }
    };

    const Content = (
        <View style={[
            styles.contentContainer,
            { height: getHeight() },
            !disabled && variant === 'outline' && { borderWidth: 2, borderColor: Colors.light.primary },
            !disabled && variant !== 'glass' && { backgroundColor: getBackgroundColor() },
            styles[`radius${size}` as keyof typeof styles],
            style
        ] as unknown as ViewStyle}>
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <>
                    {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
                    <Text style={[
                        styles.text,
                        { color: getTextColor(), fontSize: size === 'lg' ? 18 : 16 }
                    ]}>
                        {title}
                    </Text>
                </>
            )}
        </View>
    );

    if (variant === 'glass' && !disabled) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled}>
                <GlassView style={[styles.contentContainer, { height: getHeight() }, style]}>
                    {Content}
                </GlassView>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={disabled}>
            {Content}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Layout.spacing.lg,
        ...Layout.shadows.small,
    },
    text: {
        fontWeight: '600',
    },
    iconContainer: {
        marginRight: 8,
    },
    radiussm: { borderRadius: Layout.radius.md },
    radiusmd: { borderRadius: Layout.radius.lg },
    radiuslg: { borderRadius: Layout.radius.xl },
});
