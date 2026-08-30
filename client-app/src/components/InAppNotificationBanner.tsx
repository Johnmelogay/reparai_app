import { Colors } from '@/constants/Colors';
import { Bell, MessageCircle, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface InAppBannerData {
    id: string;
    title: string;
    message: string;
    type?: string;
    relatedId?: string;
}

interface InAppNotificationBannerProps {
    banner: InAppBannerData | null;
    onDismiss: () => void;
    onPress: (banner: InAppBannerData) => void;
}

export function InAppNotificationBanner({
    banner,
    onDismiss,
    onPress,
}: InAppNotificationBannerProps) {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (banner) {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss após 4 segundos
            timerRef.current = setTimeout(() => {
                handleDismiss();
            }, 4000);
        } else {
            translateY.setValue(-120);
            opacity.setValue(0);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [banner?.id]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -120,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    if (!banner) return null;

    const isMessage = banner.type === 'message';

    return (
        <View
            style={[styles.wrapper, { top: insets.top > 0 ? insets.top + 6 : 14 }]}
            pointerEvents="box-none"
        >
            <Animated.View
                style={[
                    styles.card,
                    {
                        transform: [{ translateY }],
                        opacity,
                    },
                ]}
                accessibilityRole="alert"
                accessibilityLabel={`${banner.title}: ${banner.message}`}
            >
                <TouchableOpacity
                    style={styles.contentRow}
                    activeOpacity={0.85}
                    onPress={() => {
                        handleDismiss();
                        onPress(banner);
                    }}
                >
                    <View style={[styles.iconWrap, isMessage ? styles.iconWrapMsg : styles.iconWrapReq]}>
                        {isMessage ? (
                            <MessageCircle size={20} color="#fff" />
                        ) : (
                            <Bell size={20} color="#fff" />
                        )}
                    </View>
                    <View style={styles.textWrap}>
                        <Text style={styles.title} numberOfLines={1}>
                            {banner.title}
                        </Text>
                        <Text style={styles.message} numberOfLines={2}>
                            {banner.message}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={handleDismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Fechar notificação"
                    accessibilityRole="button"
                >
                    <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 14,
        right: 14,
        zIndex: 99999,
        alignItems: 'center',
    },
    card: {
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    iconWrapMsg: {
        backgroundColor: Colors.light.primary,
    },
    iconWrapReq: {
        backgroundColor: '#0284C7',
    },
    textWrap: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    message: {
        fontSize: 12,
        color: '#CBD5E1',
        lineHeight: 16,
    },
    closeBtn: {
        padding: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
