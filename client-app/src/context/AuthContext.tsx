import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { Session, User } from '@supabase/supabase-js';
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

let makeRedirectUriFn: ((options: any) => string) | null = null;
let QueryParams: { getQueryParams: (url: string) => { params: Record<string, string> } } | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const authSession = require('expo-auth-session');
    makeRedirectUriFn = authSession.makeRedirectUri;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    QueryParams = require('expo-auth-session/build/QueryParams');
} catch (error) {
    console.warn('[Auth] expo-auth-session unavailable; OAuth disabled until dev client includes expo-crypto.');
}

// Helper to get redirect URL
const getRedirectUrl = () => {
    if (!makeRedirectUriFn) {
        return Linking.createURL('auth/callback', { scheme: 'reparaimvp' });
    }
    // preferLocalhost: false is CRITICAL for physical devices to avoid "Safari can't connect to localhost"
    const redirectUrl = makeRedirectUriFn({
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
                try {
                    // Suppress unhandled promise rejection if no browser is open
                    Promise.resolve(WebBrowser.dismissBrowser()).catch(() => { });
                } catch (e) {
                    // Ignore sync errors too
                }
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
            if (!QueryParams || !makeRedirectUriFn) {
                return { error: new Error('Auth session not available. Rebuild dev client with expo-crypto.') };
            }
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
                }
            });

            if (error) {
                const isRateLimit = error.message?.toLowerCase().includes('rate limit') ||
                    (error as any)?.code === 'over_email_send_rate_limit' ||
                    (error as any)?.status === 429;

                // Log error code and status safely without exposing tokens or email
                logger.warn('[Auth] signInWithEmail failed', {
                    code: (error as any)?.code || error.name,
                    status: (error as any)?.status || 400
                });

                let friendlyMessage = error.message;
                if (isRateLimit) {
                    // If retry_after header or parameter exists, use it; otherwise generic quota message
                    const retryAfter = (error as any)?.retry_after || (error as any)?.retryAfter;
                    if (typeof retryAfter === 'number' && retryAfter > 0) {
                        friendlyMessage = `Limite de envio atingido. Aguarde ${retryAfter} segundos antes de tentar novamente.`;
                    } else {
                        friendlyMessage = 'O limite temporário de envio de e-mails foi atingido. Tente novamente mais tarde.';
                    }
                }

                return { error: { ...error, message: friendlyMessage, isRateLimit } };
            }

            return { error: null };
        } catch (error: any) {
            logger.warn('[Auth] signInWithEmail unexpected error', {
                name: error?.name || 'Error'
            });
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
        try {
            const { clearUserStorage } = await import('@/utils/storage');
            await clearUserStorage(user?.id);
            await supabase.auth.signOut();
        } catch (e) {
            console.warn('[AuthContext] Sign out error:', e);
            await supabase.auth.signOut();
        }
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
