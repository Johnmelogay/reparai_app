import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Mic, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DescribeScreen() {
    const router = useRouter();
    const { category } = useLocalSearchParams();
    const { updateDraft } = useRequest();

    const [text, setText] = useState('');

    const handleContinue = () => {
        // Save text (empty if skipped)
        updateDraft(text);

        // Go to Interactive Form (Questions)
        router.push({
            pathname: '/request/new/interactive-form',
            params: { category }
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.dismissAll()}>
                    <X color="#999" size={24} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Text style={styles.title}>Pode descrever o problema?</Text>
                <Text style={styles.subtitle}>
                    Isso é opcional, mas ajuda a Inteligência Artificial a encontrar o técnico certo mais rápido.
                </Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: O ar condicionado faz barulho mas não gela..."
                        multiline
                        numberOfLines={6}
                        value={text}
                        onChangeText={setText}
                        autoFocus
                    />

                    <View style={styles.mediaRow}>
                        <TouchableOpacity style={styles.mediaBtn}>
                            <Camera size={20} color={Colors.light.primary} />
                            <Text style={styles.mediaText}>Foto</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mediaBtn}>
                            <Mic size={20} color={Colors.light.primary} />
                            <Text style={styles.mediaText}>Áudio</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Button
                        title={text.length > 5 ? "Continuar" : "Pular esta etapa"}
                        onPress={handleContinue}
                        variant={text.length > 5 ? 'primary' : 'outline'}
                    />
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
    },
    backArrow: {
        fontSize: 24,
        color: '#333',
    },
    content: {
        flex: 1,
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#111',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        lineHeight: 22,
    },
    inputContainer: {
        flex: 1,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 20,
        fontSize: 18,
        color: '#333',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        textAlignVertical: 'top',
        minHeight: 150,
    },
    mediaRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    mediaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    mediaText: {
        fontWeight: '600',
        color: Colors.light.primary,
    },
    footer: {
        marginTop: 'auto',
        marginBottom: 20,
    }
});
