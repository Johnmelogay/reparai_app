import React from 'react';
import { StyleSheet, TextInput, View, Text, TextInputProps, ViewStyle } from 'react-native';
import { Colors, Layout } from '@/constants/Colors';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerStyle?: ViewStyle;
}

export function Input({
    label,
    error,
    leftIcon,
    rightIcon,
    containerStyle,
    style,
    ...props
}: InputProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View style={[
                styles.inputContainer,
                error ? styles.errorBorder : styles.defaultBorder
            ]}>
                {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

                <TextInput
                    placeholderTextColor={Colors.light.textSecondary}
                    style={[styles.input, style]}
                    {...props}
                />

                {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Layout.spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.light.text,
        marginBottom: 6,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: Layout.radius.lg,
        minHeight: 50,
        paddingHorizontal: Layout.spacing.md,
        ...Layout.shadows.small,
    },
    defaultBorder: {
        borderWidth: 1,
        borderColor: 'transparent', // Looks cleaner without border typically, or very subtle
    },
    errorBorder: {
        borderWidth: 1,
        borderColor: Colors.light.danger,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.light.text,
        height: '100%',
    },
    iconLeft: {
        marginRight: 10,
    },
    iconRight: {
        marginLeft: 10,
    },
    errorText: {
        color: Colors.light.danger,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    }
});
