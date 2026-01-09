/**
 * Reparaí Type System
 * Core types for the marketplace business model
 */

// ===== 3D TAXONOMY SYSTEM =====
export interface Domain {
    id: string;
    slug: string;
    name: string;
    icon?: string;
    description?: string;
    displayOrder: number;
    isActive: boolean;
}

export interface Asset {
    id: string;
    domainId: string;
    slug: string;
    name: string;
    icon?: string;
    description?: string;
    displayOrder: number;
    isActive: boolean;
}

export interface ServiceType {
    id: string;
    slug: string;
    name: string;
    description?: string;
    icon?: string;
    displayOrder: number;
    isActive: boolean;
}

export interface TaxonomyPath {
    domain: string;  // slug
    asset: string;   // slug
    serviceType: string; // slug
}

export interface AssetServiceCompatibility {
    assetId: string;
    serviceTypeId: string;
}

export interface ProviderSpecialization {
    id: string;
    providerId: string;
    domainSlug?: string;
    assetSlug?: string;
    serviceTypeSlug?: string;
}

// ===== TICKET SYSTEM =====
export type TicketStatus = 'NEW' | 'OFFERED' | 'ACCEPTED' | 'PAID' | 'EN_ROUTE' | 'DONE' | 'CANCELED';

export type TicketTrack = 'instant' | 'evaluation' | 'workshop'; // Reparo Rápido, Precisa Avaliar, Levar para Oficina

export interface Ticket {
    id: string;
    userId: string;

    // OLD: category (deprecated, use taxonomy instead)
    category?: string;

    // NEW: 3D Taxonomy
    domainSlug?: string;
    assetSlug?: string;
    serviceTypeSlug?: string;
    issueTags?: string[]; // Array of issue tags (e.g., corrente, folga)

    track: TicketTrack;
    description: string;
    images?: string[];
    audio?: string;

    // Location (gatekeeping: partial until ACCEPTED)
    address?: string; // Full address only after PAID
    streetNumber?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    reference?: string;
    coordinates?: { latitude: number; longitude: number };

    // Status & Flow
    status: TicketStatus;
    createdAt: string;
    updatedAt: string;

    // Provider assignment
    providerId?: string;
    providerName?: string;
    offers?: TicketOffer[];

    // Payment
    ticketFee?: number; // Fee paid by client (mainly for instant)
    ticketFeePaid?: boolean;
    servicePrice?: number; // Final service price

    // Scheduling
    scheduledAt?: string; // For evaluation/workshop tracks
    estimatedArrival?: number; // Minutes for instant

    // Completion
    completedAt?: string;
    warranty?: Warranty;

    // Evidence
    completionEvidence?: string[]; // Photos of work done
}

export interface TicketOffer {
    id: string;
    providerId: string;
    providerName: string;
    price: number;
    estimatedTime?: number; // Minutes
    message?: string;
    createdAt: string;
}

// ===== PROVIDER SYSTEM =====
export type ProviderStatus = 'online' | 'offline';
export type ProviderBadge = 'registered' | 'verified' | 'professional' | 'featured' | 'Super';

export interface Provider {
    id: string;
    name: string;
    category: string;
    categories: string[]; // Can serve multiple

    // Location
    address: string;
    coordinates: { latitude: number; longitude: number };
    distance?: string; // Calculated distance
    rawDistance?: number; // Calculated distance in km (numeric)

    // Status
    status: ProviderStatus;
    badges: ProviderBadge[];

    // Reputation
    rating: number;
    reviews: number;
    operationalScore: number; // Based on response time, completion rate, etc.

    // Business Info
    image: string;
    description?: string;
    portfolio?: string[]; // Images

    // Pricing
    visitPrice?: string; // Base visit price
    hourlyRate?: number; // Added to match usePartners usage

    // Contact (gatekeeping: only shown after ACCEPTED)
    phone?: string;
    whatsapp?: string;

    // Metrics (for ranking)
    responseTime?: number; // Average in minutes
    responseRate?: number; // Percentage
    completionRate?: number; // Percentage
    cancellationRate?: number; // Percentage

    // Premium
    isPremium?: boolean;
    premiumExpiresAt?: string;
}

// ===== CATEGORY SYSTEM =====
export interface Category {
    id: string;
    name: string;
    icon: any;
    description?: string;
    tracks: TicketTrack[]; // Which tracks this category supports
}

// ===== WARRANTY SYSTEM =====
export interface Warranty {
    id: string;
    ticketId: string;
    providerId: string;
    service: string;
    expiresAt: string; // ISO date
    totalDays: number;
    activatedAt: string; // ISO date
}

// ===== LEDGER (HISTORY) =====
export interface LedgerEntry {
    id: string;
    ticketId: string;
    providerId: string;
    providerName: string;
    service: string;
    category: string;
    date: string; // ISO date
    price: number;
    warranty?: Warranty;
    status: 'completed' | 'canceled';
}

// ===== FUNNEL SYSTEM =====
export interface QuestionOption {
    label: string;
    value: string;
}

export interface Question {
    id: string;
    text: string;
    type: 'select' | 'boolean';
    options?: QuestionOption[];
    required: boolean;
}

export interface QuestionSet {
    categoryId: string;
    questions: Question[];
}

export interface ServiceRequest {
    categoryId: string;
    answers: Record<string, string>;
    userText: string;
    images?: string[];
    video?: string;
    location: { latitude: number; longitude: number };
}

// ===== USER SYSTEM =====
export interface User {
    id: string;
    name: string;
    email?: string;
    phone: string;
    avatar?: string;

    // Addresses
    addresses: UserAddress[];
    defaultAddressId?: string;

    // Payment
    paymentMethods?: PaymentMethod[];
    defaultPaymentMethodId?: string;

    // Stats
    totalRequests: number;
    averageRating: number;
}

export interface UserAddress {
    id: string;
    label: string; // "Casa", "Trabalho", etc.
    address: string;
    streetNumber?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    coordinates: { latitude: number; longitude: number };
    isDefault: boolean;
}

export interface PaymentMethod {
    id: string;
    type: 'card' | 'pix' | 'cash';
    last4?: string; // For cards
    brand?: string; // For cards
    isDefault: boolean;
}

// ===== NOTIFICATION SYSTEM =====
export interface Notification {
    id: string;
    userId: string;
    type: 'ticket_update' | 'offer_received' | 'payment_required' | 'warranty_expiring' | 'promotion';
    title: string;
    body: string;
    data?: any; // Additional data (ticketId, etc.)
    read: boolean;
    createdAt: string;
}

// ===== FILTER SYSTEM =====
export interface ProviderFilters {
    online?: boolean;
    verified?: boolean;
    category?: string;
    maxDistance?: number; // km
    minRating?: number;
    badges?: ProviderBadge[];
}

