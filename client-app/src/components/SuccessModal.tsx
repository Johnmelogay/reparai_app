import React from 'react';
import { Modal, StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { CheckCircle, Sparkles, MapPin, X } from 'lucide-react-native';
import { Colors, Layout } from '@/constants/Colors';
import { Button } from './ui/Button';

interface SuccessModalProps {
    visible: boolean;
    onClose: () => void;
    providerName: string;
}

const { width } = Dimensions.get('window');

export default function SuccessModal({ visible, onClose, providerName }: SuccessModalProps) {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                
                <View style={styles.content}>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <X size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <View style={styles.iconContainer}>
                        <View style={styles.iconBg}>
                            <CheckCircle size={48} color="#fff" />
                        </View>
                        <View style={styles.sparkle1}>
                            <Sparkles size={20} color={Colors.light.accent} />
                        </View>
                        <View style={styles.sparkle2}>
                            <Sparkles size={16} color={Colors.light.secondary} />
                        </View>
                    </View>

                    <Text style={styles.title}>Pedido Confirmado!</Text>
                    <Text style={styles.subtitle}>
                        Tudo certo! {providerName} já foi notificado e está se preparando para te atender.
                    </Text>

                    <View style={styles.noticeBox}>
                        <MapPin size={18} color={Colors.light.primary} />
                        <Text style={styles.noticeText}>
                            Acompanhe o trajeto em tempo real no mapa.
                        </Text>
                    </View>

                    <Button
                        title="Acompanhar no Mapa"
                        onPress={onClose}
                        style={styles.button}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 24,
    },
    content: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: Layout.radius.xl,
        padding: 32,
        alignItems: 'center',
        position: 'relative',
        ...Layout.shadows.large,
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 8,
        zIndex: 10,
    },
    iconContainer: {
        marginBottom: 24,
        position: 'relative',
    },
    iconBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.light.success,
        justifyContent: 'center',
        alignItems: 'center',
        ...Layout.shadows.medium,
    },
    sparkle1: {
        position: 'absolute',
        top: -10,
        right: -10,
    },
    sparkle2: {
        position: 'absolute',
        bottom: 5,
        left: -15,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.light.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    noticeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: Layout.radius.md,
        marginBottom: 32,
        width: '100%',
    },
    noticeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
        marginLeft: 10,
        flex: 1,
    },
    button: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.light.primary,
    },
});
