/**
 * Shared image upload utility.
 * Compresses images to lightweight JPEG and uploads via base64
 * (avoids the empty-blob bug with fetch(uri).blob() on React Native).
 */
import { supabase } from '@/services/supabase';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

interface UploadOptions {
    uri: string;
    bucket: string;
    path: string;
    /** Max width in pixels (height scales proportionally). Default 800. */
    maxWidth?: number;
    /** JPEG quality 0-1. Default 0.7. */
    quality?: number;
}

/**
 * Compress an image to lightweight JPEG, then upload to Supabase Storage.
 * Returns the public URL on success.
 */
export async function compressAndUpload({
    uri,
    bucket,
    path,
    maxWidth = 800,
    quality = 0.7,
}: UploadOptions): Promise<string> {
    // 1. Compress, resize → JPEG, and get base64 in one step
    const result = await manipulateAsync(
        uri,
        [{ resize: { width: maxWidth } }],
        { compress: quality, format: SaveFormat.JPEG, base64: true },
    );

    if (!result.base64) {
        throw new Error('Falha ao processar imagem.');
    }

    // 2. Decode base64 → ArrayBuffer for Supabase
    const arrayBuffer = decode(result.base64);

    // 3. Upload — always .jpg since we force JPEG
    const filePath = path.replace(/\.[^.]+$/, '.jpg');

    const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, arrayBuffer, {
            cacheControl: '3600',
            contentType: 'image/jpeg',
            upsert: true,
        });

    if (error) throw error;

    // 4. Return public URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
}
