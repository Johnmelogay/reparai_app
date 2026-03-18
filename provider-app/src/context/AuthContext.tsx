import { supabase } from '@/services/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signInWithGoogle: () => Promise<{ error: any }>;
    signInWithApple: () => Promise<{ error: any }>;
    signInWithEmail: (email: string) => Promise<{ error: any }>;
    verifyEmailOtp: (email: string, token: string) => Promise<{ error: any; session: Session | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

let makeRedirectUriFn: ((options: any) => string) | null = null;
let QueryParams: { getQueryParams: (url: string) => { params: Record<string, string> } } | null = null;

try {
    const authSession = require('expo-auth-session');
    makeRedirectUriFn = authSession.makeRedirectUri;
    QueryParams = require('expo-auth-session/build/QueryParams');
} catch (error) {
    console.warn('[Auth] expo-auth-session unavailable; OAuth disabled until dev client includes expo-crypto.');
}

const getRedirectUrl = () => {
    if (!makeRedirectUriFn) {
        return Linking.createURL('auth/callback', { scheme: 'reparaiprovider' });
    }
    const redirectUrl = makeRedirectUriFn({
        scheme: 'reparaiprovider',
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
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);

            if (session) {
                try {
                    Promise.resolve(WebBrowser.dismissBrowser()).catch(() => { });
                } catch (e) {
                    // Ignore
                }
            }
        });

        const handleDeepLink = (_event: { url: string }) => { };
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
                    skipBrowserRedirect: true,
                },
            });

            if (error) return { error };

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

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

    const signInWithEmail = async (email: string) => {
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true },
            });
            return { error };
        } catch (error) {
            return { error };
        }
    };

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
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
