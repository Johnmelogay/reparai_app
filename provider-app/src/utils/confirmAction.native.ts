import { Alert } from 'react-native';

export type ConfirmActionOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
};

export function confirmAction({
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    destructive = false,
}: ConfirmActionOptions): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result: boolean) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        Alert.alert(
            title,
            message,
            [
                {
                    text: cancelLabel,
                    style: 'cancel',
                    onPress: () => finish(false),
                },
                {
                    text: confirmLabel,
                    style: destructive ? 'destructive' : 'default',
                    onPress: () => finish(true),
                },
            ],
            {
                cancelable: true,
                onDismiss: () => finish(false),
            }
        );
    });
}
