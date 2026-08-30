import { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

export function useAppVisibility(): boolean {
    const [isVisible, setIsVisible] = useState<boolean>(() => {
        if (Platform.OS === 'web') {
            return typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
        }
        return AppState.currentState === 'active';
    });

    useEffect(() => {
        if (Platform.OS === 'web') {
            if (typeof document === 'undefined') return;

            const handleVisibilityChange = () => {
                setIsVisible(document.visibilityState === 'visible');
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        } else {
            const handleAppStateChange = (nextState: AppStateStatus) => {
                setIsVisible(nextState === 'active');
            };

            const subscription = AppState.addEventListener('change', handleAppStateChange);
            return () => {
                subscription.remove();
            };
        }
    }, []);

    return isVisible;
}
