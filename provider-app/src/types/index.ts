/**
 * Provider App Types
 * Re-exports shared types and adds provider-specific ones.
 */

// DB-level statuses (lowercase, matching live Supabase requests.status)
export type TicketStatus = 'finding' | 'offered' | 'accepted' | 'paid' | 'en_route' | 'completed' | 'canceled';
export type ContextStatus = TicketStatus | 'idle';
export type TicketTrack = 'instant' | 'evaluation' | 'workshop';
export type ProviderType = 'MOBILE' | 'FIXED';

// ===== Provider Profile (partners table) =====
export interface ProviderProfile {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
    user_type: string;
    is_online: boolean;
    location: unknown; // PostGIS geography
    service_category: string | null;
    rating: number | null;
    base_fee: number | null;
    type: ProviderType;
}

export interface PartnerSpecialization {
    id: string;
    partner_id: string;
    domain_slug: string | null;
    asset_slug: string | null;
    service_type_slug: string | null;
    created_at?: string;
}

export interface TaxonomyDomain {
    id: string;
    slug: string;
    name: string;
}

export interface TaxonomyAsset {
    id: string;
    domain_id: string;
    slug: string;
    name: string;
}

export interface TaxonomyServiceType {
    id: string;
    slug: string;
    name: string;
}

// ===== Open Request (what providers see) =====
export interface OpenRequest {
    id: string;
    category: string;
    user_text: string | null;
    ai_result_json: any | null;
    asset_slug: string | null;
    service_type_slug: string | null;
    issue_tags: string[] | null;
    lat: number;
    lng: number;
    address: string | null;       // Only city/neighborhood before paid
    neighborhood: string | null;
    city: string | null;
    dist_km: number | null;
    created_at: string;
    updated_at: string;
    expires_at: string | null;
    status: TicketStatus;
}

// ===== Active Order (provider's assigned request) =====
export interface ActiveOrder extends OpenRequest {
    user_id: string;
    provider_id: string;
    payment_method: string | null;
    payment_status: string | null;
    displacement_fee: number | null;
    // Joined client data
    client_name: string | null;
    client_avatar: string | null;
}

// ===== Provider Offer (bid) =====
export interface ProviderOffer {
    id: string;
    request_id: string;
    provider_id: string;
    status: string;
    price: number;
    estimated_time: number;
    message: string | null;
}

// ===== Notification =====
export type NotificationType = 'request' | 'message' | 'system' | 'partner';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    related_id?: string;
    is_read: boolean;
    created_at: string;
}

// ===== Chat =====
export interface ChatMessage {
    id: string;
    requestId: string;
    text: string;
    direction: 'incoming' | 'outgoing';
    createdAt: string;
    isRead: boolean;
}
