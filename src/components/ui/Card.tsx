import { Colors, Layout } from '@/constants/Colors';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { GlassView } from './GlassView';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'glass' | 'outlined' | 'flat';
    onPress?: () => void;
    padding?: number;
}

export function Card({
    children,
    style,
    variant = 'default',
    onPress,
    padding = Layout.spacing.md
}: CardProps) {

    const Container = onPress ? TouchableOpacity : View;

    if (variant === 'glass') {
        return (
            <Container activeOpacity={onPress ? 0.8 : 1} style={[styles.wrapper, style]}>
                <GlassView style={{ padding }}>
                    {children}
                </GlassView>
            </Container>
        );
    }

    const getVariantStyle = () => {
        switch (variant) {
            case 'outlined':
                return styles.outlined;
            case 'flat':
                return styles.flat;
            default:
                return styles.default;
        }
    };

    return (
        <Container
            activeOpacity={onPress ? 0.8 : 1}
            style={[
                styles.wrapper,
                styles.base,
                getVariantStyle(),
                { padding },
                style
            ]}
        >
            {children}
        </Container>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: Layout.radius.lg,
        overflow: 'hidden',
    },
    base: {
        backgroundColor: Colors.light.card,
    },
    default: {
        ...Layout.shadows.small,
    },
    outlined: {
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    flat: {
        backgroundColor: Colors.light.background, // or slightly darker/lighter depending on context
    }
});
