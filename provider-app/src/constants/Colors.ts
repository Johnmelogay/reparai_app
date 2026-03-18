/**
 * Provider App Color System
 * Inherits the base brand colors but uses a darker, professional tone
 * to differentiate the provider experience from the client app.
 */

const harvestOrange = '#ff7b00ff';
const schoolBusYellow = '#FEC52E';
const chartreuse = '#9fd211ff';
const white = '#FFFFFF';
const ebony = '#5B6A57';

// Provider app uses a deeper teal accent to differentiate
const providerAccent = '#0D9488';  // Teal-600
const providerDark = '#1A1A2E';    // Deep navy background

const tintColorLight = harvestOrange;

export const Colors = {
    light: {
        text: '#363739ff',
        textSecondary: ebony,
        textMuted: '#94A3B8',
        background: '#F2F4F8',
        tint: tintColorLight,
        tabIconDefault: '#94A3B8',
        tabIconSelected: harvestOrange,
        primary: harvestOrange,
        primaryGradientStart: harvestOrange,
        primaryGradientEnd: schoolBusYellow,
        secondary: schoolBusYellow,
        accent: providerAccent,
        success: chartreuse,
        successBackground: '#F0F9E6',
        warning: schoolBusYellow,
        warningBackground: '#FFF9E5',
        danger: '#FF3B30',
        card: white,
        border: '#E5E5EA',
        glass: 'rgba(255, 255, 255, 0.9)',
        shadow: '#000000',
        // Provider-specific
        online: '#22C55E',
        offline: '#94A3B8',
        headerDark: providerDark,
    },
    dark: {
        text: white,
        textSecondary: '#AAAAAA',
        textMuted: '#64748B',
        background: providerDark,
        tint: white,
        tabIconDefault: '#64748B',
        tabIconSelected: harvestOrange,
        primary: harvestOrange,
        secondary: schoolBusYellow,
        accent: providerAccent,
        success: chartreuse,
        successBackground: '#1A2E05',
        warning: schoolBusYellow,
        warningBackground: '#3F2600',
        danger: '#FF453A',
        card: '#1C1C1E',
        border: '#38383A',
        glass: 'rgba(30, 30, 30, 0.8)',
        shadow: '#000000',
        online: '#22C55E',
        offline: '#64748B',
        headerDark: providerDark,
    },
};

export const Layout = {
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 40,
    },
    radius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 32,
        round: 9999,
    },
    shadows: {
        small: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
        },
        medium: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 4,
        },
        large: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 8,
        },
    },
};
