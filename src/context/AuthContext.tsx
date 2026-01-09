import { supabase } from '@/services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';

WebBrowser.maybeCompleteAuthSession(); // For web

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signInWithGoogle: () => Promise<{ error: any }>;
    signInWithApple: () => Promise<{ error: any }>;
    signInWithEmail: (email: string) => Promise<{ error: any }>;
    verifyEmailOtp: (email: string, token: string) => Promise<{ error: any; session: Session | null }>;
    signOut: () => Promise<void>;
    isGuest: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Helper to get redirect URL
const getRedirectUrl = () => {
    // preferLocalhost: false is CRITICAL for physical devices to avoid "Safari can't connect to localhost"
    const redirectUrl = makeRedirectUri({
        scheme: 'reparaimvp',
        path: 'auth/callback',
        preferLocalhost: false,
    });
    console.log(`[Auth] Redirect URL: ${redirectUrl}`);
    return redirectUrl;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // 2. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);

            // Close browser on successful auth if open
            if (session) {
                WebBrowser.dismissBrowser();
            }
        });

        // 3. Handle deep link (optional, if default listeners fail)
        const handleDeepLink = (event: { url: string }) => {
            // console.log("Deep link:", event.url);
        };
        Linking.addEventListener('url', handleDeepLink);

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const performOAuth = async (provider: 'google' | 'apple') => {
        try {
            const redirectUrl = getRedirectUrl();


            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // We manage the browser via WebBrowser
                },
            });

            if (error) return { error };

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUrl
                );

                if (result.type === 'success' && result.url) {
                    const { params } = QueryParams.getQueryParams(result.url);
                    if (params['access_token'] && params['refresh_token']) {
                        const { error: setSessionError } = await supabase.auth.setSession({
                            access_token: params['access_token'],
                            refresh_token: params['refresh_token'],
                        });
                        if (setSessionError) return { error: setSessionError };
                        return { error: null };
                    }
                }
            }
            return { error: null };
        } catch (error) {
            return { error };
        }
    };

    const signInWithGoogle = () => performOAuth('google');
    const signInWithApple = () => performOAuth('apple');

    // Email OTP Login (Step 1: Send Code)
    const signInWithEmail = async (email: string) => {
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    // Leaving this out often defaults to OTP code. 
                    // If you provided an emailRedirectTo, it might force Magic Link.
                    // To force Code, simply do not provide emailRedirectTo, OR ensure template has {{ .Token }}
                }
            });
            return { error };
        } catch (error) {
            return { error };
        }
    };

    // Email OTP Verify (Step 2: Check Code)
    const verifyEmailOtp = async (email: string, token: string) => {
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'email',
            });
            return { error, session: data.session };
        } catch (error) {
            return { error, session: null };
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const isGuest = !session;

    return (
        <AuthContext.Provider value={{
            session,
            user,
            isLoading,
            signInWithGoogle,
            signInWithApple,
            signInWithEmail,
            verifyEmailOtp,
            signOut,
            isGuest
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
