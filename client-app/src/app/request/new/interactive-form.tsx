import { TriButton, TriOption } from '@/components/ui/TriButton';
import { Colors, Layout } from '@/constants/Colors';
import { useRequest } from '@/context/RequestContext';
import { aiService, DiagnosticQuestion } from '@/services/aiService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


// Removed hardcoded default questions


export default function InteractiveFormScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const categoryId = params.category as string;

    const {
        funnelAnswers,
        setFunnelAnswer,
        updateDraft,
        description,
        resetFunnel,
        setAiResult,
        setFinalConfidence,
        addQuestionsToHistory,
        questionsHistory, // Get history from context
        finalConfidence // Get stored confidence
    } = useRequest();

    // Initialize state FROM HISTORY if available, else empty
    const [questions, setQuestions] = useState<DiagnosticQuestion[]>(questionsHistory || []);
    const [currentStep, setCurrentStep] = useState(questionsHistory.length > 0 ? questionsHistory.length - 1 : 0);
    const [isLoadingAI, setIsLoadingAI] = useState(questionsHistory.length === 0); // Only load if no history
    const [progress] = useState(new Animated.Value(0));
    const [currentConfidence, setCurrentConfidence] = useState<number>(finalConfidence || 0);

    // Custom Input State
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customInputValue, setCustomInputValue] = useState('');

    const CONFIDENCE_THRESHOLD = 0.7;
    const MAX_QUESTIONS = 5; // Reduced from 10 to 5 per user request

    // Initialize: Fetch first AI questions ONLY if we have none
    useEffect(() => {
        const init = async () => {
            if (questions.length === 0) {
                await fetchAiQuestions();
            }
        };
        init();
    }, []);

    // Sync history
    useEffect(() => {
        if (questions.length > 0) {
            addQuestionsToHistory(questions);
        }
    }, [questions]);

    // Update progress bar
    useEffect(() => {
        // Fixed total steps for better UI feedback
        const totalSteps = MAX_QUESTIONS;
        Animated.timing(progress, {
            toValue: questions.length > 0 ? (currentStep + 1) / totalSteps : 0.1,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentStep, questions.length]);

    const handleAnswer = async (value: string) => {
        if (value === 'other') {
            setShowCustomInput(true);
            return;
        }

        const currentQ = questions[currentStep];
        setFunnelAnswer(currentQ.id, value);

        // Pre-calculate the new answers state to avoid race condition
        const updatedAnswers = { ...funnelAnswers, [currentQ.id]: value };

        // Check if this is the last question in current list
        const isLastQuestion = currentStep >= questions.length - 1;

        if (!isLastQuestion) {
            // Not the last question -> just advance
            setTimeout(() => setCurrentStep(prev => prev + 1), 300);
        } else {
            // Last question -> fetch AI for more questions, then advance
            await fetchAiQuestions(updatedAnswers);
            // After AI returns, advance to the newly added question
            setTimeout(() => setCurrentStep(prev => prev + 1), 300);
        }
    };

    const handleCustomSubmit = async () => {
        if (!customInputValue.trim()) {
            Alert.alert("Atenção", "Por favor descreva o item/problema.");
            return;
        }
        setShowCustomInput(false);
        // Use the typed text as the answer value
        await handleAnswer(customInputValue);
        setCustomInputValue('');
    };



    const fetchAiQuestions = async (currentAnswersOverride?: Record<string, string>) => {
        setIsLoadingAI(true);
        try {
            const effectiveAnswers = currentAnswersOverride || funnelAnswers;
            const { questions: newQs, confidence } = await aiService.generateQuestions(
                categoryId,
                effectiveAnswers,
                description,
                CONFIDENCE_THRESHOLD
            );

            // Store the latest confidence (local and global context)
            setCurrentConfidence(confidence);
            setFinalConfidence(confidence);

            // HARD LIMIT: If we've reached max questions, force finish
            if (questions.length >= MAX_QUESTIONS) {
                console.log(`Reached max questions (${MAX_QUESTIONS}), forcing finish with confidence ${confidence}`);
                finishFunnel();
                return;
            }

            // LOGIC: STRICT 0.7 THRESHOLD
            if (confidence >= CONFIDENCE_THRESHOLD) {
                // High confidence -> Finish
                finishFunnel();
                return;
            }

            // If confidence < 0.9, we need more questions.
            let uniqueNew: DiagnosticQuestion[] = [];

            if (newQs && newQs.length > 0) {
                // Filter out questions where the TEXT is identical to what we already have.
                // If the ID is the same but text is different, we accept it and PATCH the id.
                uniqueNew = newQs.filter(nq =>
                    !questions.some(eq => eq.text.toLowerCase() === nq.text.toLowerCase())
                ).map(nq => {
                    // Check if ID collision exists
                    if (questions.some(eq => eq.id === nq.id)) {
                        return { ...nq, id: `${nq.id}_${Date.now()}` };
                    }
                    return nq;
                });
            }

            if (uniqueNew.length > 0) {
                setQuestions(prev => [...prev, ...uniqueNew]);
                // Don't advance here - let handleAnswer control the step advancement
            } else {
                // No new questions generated and confidence is low
                // Force finish instead of showing fallback error
                console.log('AI stuck with low confidence, forcing finish');
                finishFunnel();
            }

        } catch (e) {
            console.error(e);
            Alert.alert("Erro", "Falha ao analisar diagnóstico. Tente novamente.");
            // Do not finishFunnel on error to prevent bad requests
        } finally {
            setIsLoadingAI(false);
        }
    };

    const finishFunnel = async () => {
        setIsLoadingAI(true); // Show analyzing spinner
        try {
            // PRE-ANALYSIS: Ensure we have the summary BEFORE going to details/match
            const analysis = await aiService.analyzeRequest({
                requestId: 'temp-draft', // ID is generated later
                category: categoryId,
                answers: funnelAnswers,
                userText: description,
                lat: 0,
                lng: 0
            });

            if (analysis) {
                setAiResult(analysis.analysis);
            }

            router.push({
                pathname: '/request/new/details',
                params: { category: categoryId }
            });

        } catch (e) {
            console.error("Final analysis failed", e);
            // Proceed anyway
            router.push({
                pathname: '/request/new/details',
                params: { category: categoryId }
            });
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            router.back();
        }
    };

    const currentQuestion = questions[currentStep];
    const currentAnswer = funnelAnswers[currentQuestion?.id];

    // Skeleton Component matching the UI layout
    const SkeletonResults = () => {
        const opacity = React.useRef(new Animated.Value(0.3)).current;

        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
                ])
            ).start();
        }, []);

        return (
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
                {/* Question Title Skeleton */}
                <View style={{ marginBottom: 32 }}>
                    <Animated.View style={{ height: 32, width: '90%', backgroundColor: '#E1E9EE', borderRadius: 4, marginBottom: 10, opacity }} />
                    <Animated.View style={{ height: 32, width: '60%', backgroundColor: '#E1E9EE', borderRadius: 4, opacity }} />
                </View>

                {/* Option Cards Skeleton */}
                <View style={{ gap: 12 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Animated.View
                            key={i}
                            style={{
                                height: 70,
                                width: '100%',
                                backgroundColor: '#fff',
                                borderRadius: 20,
                                borderWidth: 2,
                                borderColor: 'rgba(0,0,0,0.05)',
                                opacity
                            }}
                        />
                    ))}
                </View>

                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Text style={{ color: '#999', fontSize: 14 }}>A IA analisando seu caso...</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Text style={{ fontSize: 24, color: '#333' }}>←</Text>
                </TouchableOpacity>
                <View style={styles.progressWrapper}>
                    <View style={styles.progressBg}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.stepLabel}>
                        {isLoadingAI ? 'Analisando...' : `Pergunta ${currentStep + 1} de ${MAX_QUESTIONS}`}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/')} style={styles.closeBtn}>
                    <X size={24} color="#999" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {isLoadingAI ? (
                        <SkeletonResults />
                    ) : (
                        currentQuestion && (
                            <View style={styles.stepContainer}>
                                <Text style={styles.questionText}>
                                    {showCustomInput ? "Por favor, especifique:" : currentQuestion.text}
                                </Text>

                                {showCustomInput ? (
                                    <View style={{ gap: 20 }}>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.textInput}
                                                placeholder="Ex: Microondas, Drone, Cafeteira..."
                                                value={customInputValue}
                                                onChangeText={setCustomInputValue}
                                                autoFocus
                                            />
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.confirmBtn, !customInputValue && styles.btnDisabled]}
                                            onPress={handleCustomSubmit}
                                            disabled={!customInputValue}
                                        >
                                            <Text style={styles.confirmBtnText}>Confirmar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{ alignSelf: 'center', padding: 10 }}
                                            onPress={() => setShowCustomInput(false)}
                                        >
                                            <Text style={{ color: '#999' }}>Cancelar</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    (currentQuestion.type === 'select' || (currentQuestion.options && currentQuestion.options.length > 0)) ? (
                                        <View style={styles.optionsContainer}>
                                            {(() => {
                                                // Filter out duplicate/variant "Outro" options from AI to prevent clashes
                                                const cleanOptions = currentQuestion.options?.filter(o =>
                                                    o.value.toLowerCase() !== 'other' &&
                                                    o.value.toLowerCase() !== 'outro' &&
                                                    !o.label.toLowerCase().includes('outro')
                                                ) || [];

                                                // Always append our standardized manual input option
                                                const displayOptions = [...cleanOptions, { label: 'Outro / Especificar', value: 'other' }];

                                                return displayOptions.map((opt) => (
                                                    <TouchableOpacity
                                                        key={opt.value}
                                                        style={[
                                                            styles.optionCard,
                                                            currentAnswer === opt.value && styles.optionCardSelected,
                                                            opt.value === 'other' && { borderStyle: 'dashed' }
                                                        ]}
                                                        onPress={() => handleAnswer(opt.value)}
                                                    >
                                                        <Text style={[
                                                            styles.optionLabel,
                                                            currentAnswer === opt.value && styles.optionLabelSelected
                                                        ]}>{opt.label}</Text>
                                                        {currentAnswer === opt.value &&
                                                            <Check size={20} color={Colors.light.primary} />
                                                        }
                                                    </TouchableOpacity>
                                                ));
                                            })()}
                                        </View>
                                    ) : (
                                        <View>
                                            <TriButton
                                                value={currentAnswer as TriOption}
                                                onChange={(val) => handleAnswer(val)}
                                            />
                                            {/* Always allow escaping to manual input even for Yes/No */}
                                            <TouchableOpacity
                                                style={{ marginTop: 24, alignSelf: 'center', padding: 10 }}
                                                onPress={() => handleAnswer('other')}
                                            >
                                                <Text style={{ color: Colors.light.primary, fontSize: 16, fontWeight: '600' }}>
                                                    Outro / Especificar
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )
                                )}
                            </View>
                        )
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
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
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backBtn: { width: 40 },
    progressWrapper: { flex: 1, alignItems: 'center' },
    progressBg: {
        width: '80%',
        height: 6,
        backgroundColor: '#E5E5EA',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: { height: '100%', backgroundColor: Colors.light.primary },
    stepLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.light.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    closeBtn: { width: 40, alignItems: 'flex-end' },
    content: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 100 },
    stepContainer: { flex: 1, paddingHorizontal: 24 },
    questionText: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.light.text,
        marginBottom: 32,
        lineHeight: 32,
        letterSpacing: -0.5,
    },
    optionsContainer: { gap: 12 },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.05)',
        ...Layout.shadows.small,
    },
    optionCardSelected: {
        borderColor: Colors.light.primary,
        backgroundColor: '#FF7B0505',
    },
    optionLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#444',
    },
    optionLabelSelected: { color: Colors.light.primary },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
    },
    loadingText: {
        fontSize: 18,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 26,
    },
    inputWrapper: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5EA',
        padding: 15,
    },
    textInput: {
        fontSize: 18,
        color: '#333',
        minHeight: 50,
    },
    confirmBtn: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        ...Layout.shadows.small,
    },
    btnDisabled: {
        backgroundColor: '#ccc',
        opacity: 0.7,
        shadowOpacity: 0
    },
    confirmBtnText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    }
});
