import { Colors, Layout } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { usePartnerSpecializations } from '@/hooks/usePartnerSpecializations';
import { useProviderProfile } from '@/hooks/useProviderProfile';
import { supabase } from '@/services/supabase';
import { compressAndUpload } from '@/utils/imageUpload';
import { fetchAssets, fetchDomains, fetchServiceTypes } from '@/services/taxonomy';
import { TaxonomyAsset, TaxonomyDomain, TaxonomyServiceType } from '@/types';
import { normalizeCategoryDomain } from '@/utils/category';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, MapPin, Plus, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type EditableSpecialization = {
    domain_slug: string | null;
    asset_slug: string | null;
    service_type_slug: string | null;
};

const SERVICE_CATEGORY_OPTIONS = [
    { value: 'mobilidade', label: 'Mobilidade' },
    { value: 'casa', label: 'Casa' },
    { value: 'tecnologia', label: 'Tecnologia' },
];

const PROVIDER_TYPES = [
    { value: 'MOBILE', label: 'Móvel' },
    { value: 'FIXED', label: 'Oficina' },
] as const;

const EMPTY_DOMAINS: TaxonomyDomain[] = [];
const EMPTY_ASSETS: TaxonomyAsset[] = [];
const EMPTY_SERVICE_TYPES: TaxonomyServiceType[] = [];

export default function EditProviderProfileScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { profile, loading: profileLoading, updateProfile, refetch } = useProviderProfile();
    const {
        specializations,
        loading: specializationsLoading,
        saveSpecializations,
    } = usePartnerSpecializations();

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [serviceCategory, setServiceCategory] = useState<string | null>(null);
    const [baseFeeText, setBaseFeeText] = useState('');
    const [providerType, setProviderType] = useState<'MOBILE' | 'FIXED'>('MOBILE');
    const [isOnline, setIsOnline] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [hasLocation, setHasLocation] = useState(false);
    const [saving, setSaving] = useState(false);
    const [updatingLocation, setUpdatingLocation] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [draftSpecializations, setDraftSpecializations] = useState<EditableSpecialization[]>([]);
    const [selectedDomainSlug, setSelectedDomainSlug] = useState<string | null>(null);
    const [selectedAssetSlug, setSelectedAssetSlug] = useState<string | null>(null);
    const [selectedServiceTypeSlug, setSelectedServiceTypeSlug] = useState<string | null>(null);

    const { data: taxonomyData, isLoading: taxonomyLoading } = useQuery({
        queryKey: ['provider_taxonomy'],
        queryFn: async () => {
            const [domains, assets, serviceTypes] = await Promise.all([
                fetchDomains(),
                fetchAssets(),
                fetchServiceTypes(),
            ]);
            return { domains, assets, serviceTypes };
        },
        staleTime: 15 * 60 * 1000,
    });

    const domains = taxonomyData?.domains ?? EMPTY_DOMAINS;
    const assets = taxonomyData?.assets ?? EMPTY_ASSETS;
    const serviceTypes = taxonomyData?.serviceTypes ?? EMPTY_SERVICE_TYPES;

    useEffect(() => {
        if (!profile) return;
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setServiceCategory(normalizeCategoryDomain(profile.service_category));
        setBaseFeeText(profile.base_fee != null ? String(profile.base_fee) : '');
        setProviderType(profile.type || 'MOBILE');
        setIsOnline(!!profile.is_online);
        setAvatarUrl(profile.avatar_url || null);
        setHasLocation(!!profile.location);
    }, [profile]);

    useEffect(() => {
        if (!specializations.length) {
            setDraftSpecializations([]);
            return;
        }

        setDraftSpecializations(
            specializations.map((spec) => ({
                domain_slug: spec.domain_slug,
                asset_slug: spec.asset_slug,
                service_type_slug: spec.service_type_slug,
            }))
        );
    }, [specializations]);

    const assetsForSelectedDomain = useMemo(() => {
        if (!selectedDomainSlug) return assets;

        const domain = domains.find((d) => d.slug === selectedDomainSlug);
        if (!domain) return assets;
        return assets.filter((asset) => asset.domain_id === domain.id);
    }, [assets, domains, selectedDomainSlug]);

    const domainLabel = (slug: string | null) => domains.find((d) => d.slug === slug)?.name || 'Todos os domínios';
    const assetLabel = (slug: string | null) => assets.find((a) => a.slug === slug)?.name || 'Todos os assets';
    const serviceTypeLabel = (slug: string | null) => serviceTypes.find((s) => s.slug === slug)?.name || 'Todos os serviços';

    const handleAvatarUpload = async () => {
        if (!user) return;

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permissão necessária', 'Permita acesso às fotos para atualizar seu avatar.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1, // raw — compression handled by compressAndUpload
        });

        if (result.canceled || !result.assets?.[0]) return;

        try {
            setUploadingAvatar(true);
            const nextAvatarUrl = await compressAndUpload({
                uri: result.assets[0].uri,
                bucket: 'partner-avatars',
                path: `${user.id}/avatar-${Date.now()}.jpg`,
                maxWidth: 400,
                quality: 0.7,
            });

            setAvatarUrl(nextAvatarUrl);

            const { error } = await updateProfile({ avatar_url: nextAvatarUrl });
            if (error) throw error;

            Alert.alert('Avatar atualizado', 'Sua foto foi salva com sucesso.');
        } catch (error: any) {
            Alert.alert('Erro ao enviar imagem', error?.message || 'Não foi possível atualizar o avatar.');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleUpdateLocation = async () => {
        try {
            setUpdatingLocation(true);
            const permission = await Location.requestForegroundPermissionsAsync();

            if (!permission.granted) {
                Alert.alert('Permissão necessária', 'Permita acesso à localização para ficar visível no mapa.');
                return;
            }

            const currentPosition = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { error } = await supabase.rpc('set_my_partner_location', {
                input_lat: currentPosition.coords.latitude,
                input_long: currentPosition.coords.longitude,
            });

            if (error) throw error;

            setHasLocation(true);
            await refetch();
            Alert.alert('Localização atualizada', 'Sua localização operacional foi salva.');
        } catch (error: any) {
            Alert.alert('Erro de localização', error?.message || 'Não foi possível atualizar sua localização.');
        } finally {
            setUpdatingLocation(false);
        }
    };

    const handleAddSpecialization = () => {
        const nextSpec: EditableSpecialization = {
            domain_slug: selectedDomainSlug,
            asset_slug: selectedAssetSlug,
            service_type_slug: selectedServiceTypeSlug,
        };

        const exists = draftSpecializations.some(
            (spec) =>
                spec.domain_slug === nextSpec.domain_slug &&
                spec.asset_slug === nextSpec.asset_slug &&
                spec.service_type_slug === nextSpec.service_type_slug
        );

        if (exists) return;

        setDraftSpecializations((prev) => [nextSpec, ...prev]);
    };

    const handleRemoveSpecialization = (indexToRemove: number) => {
        setDraftSpecializations((prev) => prev.filter((_, index) => index !== indexToRemove));
    };

    const validateForOnline = () => {
        const missing: string[] = [];
        if (!fullName.trim()) missing.push('nome');
        if (!serviceCategory) missing.push('categoria principal');
        if (!hasLocation) missing.push('localização');

        return missing;
    };

    const handleSave = async () => {
        const missingForOnline = isOnline ? validateForOnline() : [];

        if (missingForOnline.length > 0) {
            Alert.alert(
                'Perfil incompleto para ficar online',
                `Para ficar online, complete: ${missingForOnline.join(', ')}.`
            );
            return;
        }

        setSaving(true);

        const parsedBaseFee = baseFeeText.trim() ? Number(baseFeeText.replace(',', '.')) : null;
        if (parsedBaseFee != null && Number.isNaN(parsedBaseFee)) {
            Alert.alert('Valor inválido', 'Informe uma taxa base válida. Ex: 80 ou 80.50');
            setSaving(false);
            return;
        }

        const { error: profileError } = await updateProfile({
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            service_category: normalizeCategoryDomain(serviceCategory),
            base_fee: parsedBaseFee,
            type: providerType,
            is_online: isOnline,
            avatar_url: avatarUrl,
        });

        if (profileError) {
            setSaving(false);
            Alert.alert('Erro ao salvar perfil', 'Não foi possível atualizar seus dados.');
            return;
        }

        const { error: specsError } = await saveSpecializations(draftSpecializations);
        setSaving(false);

        if (specsError) {
            Alert.alert('Perfil salvo parcialmente', 'Dados principais salvos, mas especializações não foram atualizadas.');
            return;
        }

        await refetch();
        Alert.alert('Perfil atualizado', 'Seu perfil foi salvo com sucesso.', [
            { text: 'OK', onPress: () => router.back() },
        ]);
    };

    if (profileLoading || taxonomyLoading || specializationsLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={20} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar Perfil</Text>
                <View style={styles.headerRight} />
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View>
                        <View style={styles.avatarSection}>
                            {avatarUrl ? (
                                <ExpoImage source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarPlaceholderText}>
                                        {fullName?.trim()?.[0]?.toUpperCase() || 'P'}
                                    </Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={styles.avatarButton}
                                onPress={handleAvatarUpload}
                                disabled={uploadingAvatar}
                            >
                                {uploadingAvatar ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Camera size={16} color="#fff" />
                                        <Text style={styles.avatarButtonText}>Trocar Foto</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Dados Principais</Text>

                            <Text style={styles.label}>Nome do perfil</Text>
                            <TextInput
                                value={fullName}
                                onChangeText={setFullName}
                                style={styles.input}
                                placeholder="Nome de exibição"
                                placeholderTextColor={Colors.light.textMuted}
                            />

                            <Text style={styles.label}>Telefone</Text>
                            <TextInput
                                value={phone}
                                onChangeText={setPhone}
                                style={styles.input}
                                placeholder="(69) 99999-9999"
                                placeholderTextColor={Colors.light.textMuted}
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.label}>Taxa base (R$)</Text>
                            <TextInput
                                value={baseFeeText}
                                onChangeText={setBaseFeeText}
                                style={styles.input}
                                placeholder="Ex: 80"
                                placeholderTextColor={Colors.light.textMuted}
                                keyboardType="decimal-pad"
                            />

                            <Text style={styles.label}>Categoria principal</Text>
                            <View style={styles.chipsWrap}>
                                {SERVICE_CATEGORY_OPTIONS.map((option) => {
                                    const active = serviceCategory === option.value;
                                    return (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => setServiceCategory(option.value)}
                                        >
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Tipo de atendimento</Text>
                            <View style={styles.typeRow}>
                                {PROVIDER_TYPES.map((item) => {
                                    const active = providerType === item.value;
                                    return (
                                        <TouchableOpacity
                                            key={item.value}
                                            style={[styles.typeButton, active && styles.typeButtonActive]}
                                            onPress={() => setProviderType(item.value)}
                                        >
                                            <Text style={[styles.typeButtonText, active && styles.typeButtonTextActive]}>{item.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Disponibilidade e Mapa</Text>

                            <View style={styles.rowBetween}>
                                <View>
                                    <Text style={styles.label}>Status online</Text>
                                    <Text style={styles.helperText}>Somente perfis completos devem ficar online.</Text>
                                </View>
                                <Switch
                                    value={isOnline}
                                    onValueChange={setIsOnline}
                                    trackColor={{ false: '#d1d5db', true: Colors.light.online + '66' }}
                                    thumbColor={isOnline ? Colors.light.online : '#f4f4f5'}
                                />
                            </View>

                            <View style={styles.locationBox}>
                                <View>
                                    <Text style={styles.label}>Localização operacional</Text>
                                    <Text style={styles.helperText}>{hasLocation ? 'Localização cadastrada' : 'Localização ainda não cadastrada'}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.locationButton}
                                    onPress={handleUpdateLocation}
                                    disabled={updatingLocation}
                                >
                                    {updatingLocation ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <MapPin size={16} color="#fff" />
                                            <Text style={styles.locationButtonText}>Atualizar</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Especializações</Text>
                            <Text style={styles.helperText}>Defina combinações de domínio, asset e tipo de serviço.</Text>

                            <Text style={styles.label}>Domínio</Text>
                            <View style={styles.chipsWrap}>
                                <TouchableOpacity
                                    style={[styles.chip, !selectedDomainSlug && styles.chipActive]}
                                    onPress={() => {
                                        setSelectedDomainSlug(null);
                                        setSelectedAssetSlug(null);
                                    }}
                                >
                                    <Text style={[styles.chipText, !selectedDomainSlug && styles.chipTextActive]}>Todos</Text>
                                </TouchableOpacity>
                                {domains.map((domain: TaxonomyDomain) => {
                                    const active = selectedDomainSlug === domain.slug;
                                    return (
                                        <TouchableOpacity
                                            key={domain.id}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => {
                                                setSelectedDomainSlug(domain.slug);
                                                setSelectedAssetSlug(null);
                                            }}
                                        >
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{domain.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Asset</Text>
                            <View style={styles.chipsWrap}>
                                <TouchableOpacity
                                    style={[styles.chip, !selectedAssetSlug && styles.chipActive]}
                                    onPress={() => setSelectedAssetSlug(null)}
                                >
                                    <Text style={[styles.chipText, !selectedAssetSlug && styles.chipTextActive]}>Todos</Text>
                                </TouchableOpacity>
                                {assetsForSelectedDomain.map((asset: TaxonomyAsset) => {
                                    const active = selectedAssetSlug === asset.slug;
                                    return (
                                        <TouchableOpacity
                                            key={asset.id}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => setSelectedAssetSlug(asset.slug)}
                                        >
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{asset.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Tipo de serviço</Text>
                            <View style={styles.chipsWrap}>
                                <TouchableOpacity
                                    style={[styles.chip, !selectedServiceTypeSlug && styles.chipActive]}
                                    onPress={() => setSelectedServiceTypeSlug(null)}
                                >
                                    <Text style={[styles.chipText, !selectedServiceTypeSlug && styles.chipTextActive]}>Todos</Text>
                                </TouchableOpacity>
                                {serviceTypes.map((serviceType: TaxonomyServiceType) => {
                                    const active = selectedServiceTypeSlug === serviceType.slug;
                                    return (
                                        <TouchableOpacity
                                            key={serviceType.id}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => setSelectedServiceTypeSlug(serviceType.slug)}
                                        >
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{serviceType.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity style={styles.addSpecButton} onPress={handleAddSpecialization}>
                                <Plus size={16} color="#fff" />
                                <Text style={styles.addSpecButtonText}>Adicionar Especialização</Text>
                            </TouchableOpacity>

                            {draftSpecializations.length === 0 ? (
                                <Text style={styles.emptySpecsText}>Nenhuma especialização cadastrada.</Text>
                            ) : (
                                draftSpecializations.map((spec, index) => (
                                    <View key={`${spec.domain_slug || 'any'}-${spec.asset_slug || 'any'}-${spec.service_type_slug || 'any'}-${index}`} style={styles.specRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.specTitle}>{domainLabel(spec.domain_slug)}</Text>
                                            <Text style={styles.specSubtitle}>{assetLabel(spec.asset_slug)} • {serviceTypeLabel(spec.service_type_slug)}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => handleRemoveSpecialization(index)}>
                                            <Trash2 size={18} color={Colors.light.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Salvar Alterações</Text>}
                        </TouchableOpacity>
                    </View>
                </TouchableWithoutFeedback>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Layout.spacing.md,
        backgroundColor: Colors.light.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.light.text,
    },
    headerRight: {
        width: 36,
        height: 36,
    },
    content: {
        padding: Layout.spacing.md,
        gap: Layout.spacing.md,
        paddingBottom: 40,
    },
    avatarSection: {
        backgroundColor: Colors.light.card,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
        alignItems: 'center',
        gap: Layout.spacing.sm,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 2,
        borderColor: Colors.light.border,
    },
    avatarPlaceholder: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary + '20',
    },
    avatarPlaceholderText: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.light.primary,
    },
    avatarButton: {
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.light.primary,
        paddingHorizontal: Layout.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    avatarButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    card: {
        backgroundColor: Colors.light.card,
        borderRadius: Layout.radius.lg,
        padding: Layout.spacing.md,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: Layout.spacing.sm,
    },
    label: {
        fontSize: 13,
        color: Colors.light.textMuted,
        marginBottom: 6,
        marginTop: Layout.spacing.sm,
    },
    input: {
        height: 46,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: '#fff',
        paddingHorizontal: Layout.spacing.md,
        color: Colors.light.text,
        fontSize: 15,
    },
    chipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: '#fff',
    },
    chipActive: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    chipText: {
        fontSize: 13,
        color: Colors.light.text,
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    typeRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    typeButton: {
        flex: 1,
        height: 42,
        borderRadius: Layout.radius.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    typeButtonActive: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    typeButtonText: {
        color: Colors.light.text,
        fontWeight: '600',
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    helperText: {
        color: Colors.light.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    locationBox: {
        marginTop: Layout.spacing.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Layout.radius.md,
        padding: Layout.spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    locationButton: {
        height: 36,
        borderRadius: 18,
        paddingHorizontal: 12,
        backgroundColor: Colors.light.accent,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    addSpecButton: {
        marginTop: Layout.spacing.md,
        height: 42,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    addSpecButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    emptySpecsText: {
        marginTop: Layout.spacing.sm,
        color: Colors.light.textMuted,
        fontSize: 13,
    },
    specRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Layout.radius.md,
        paddingHorizontal: Layout.spacing.md,
        paddingVertical: Layout.spacing.sm,
        marginTop: 8,
        gap: 12,
    },
    specTitle: {
        color: Colors.light.text,
        fontWeight: '600',
        fontSize: 14,
    },
    specSubtitle: {
        color: Colors.light.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    saveButton: {
        height: 52,
        borderRadius: Layout.radius.md,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Layout.spacing.sm,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
});
