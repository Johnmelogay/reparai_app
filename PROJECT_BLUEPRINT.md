# REPARAÍ Project Blueprint & Architecture Spec

REPARAÍ is a dual-app mobile ecosystem (Client App and Provider App) built on **React Native / Expo Router** and powered by **Supabase** with **Gemini AI Edge Functions** for dynamic diagnostics and 3D taxonomy matchmaking.

This document serves as the absolute source of truth for the codebase topography, state anatomy, and nervous system flow.

---

## 1. Topography (The Skeleton)

The repository is structured as a monorepo-style setup containing three distinct workspace directories:
- **`client-app/`**: Expo React Native application for consumers.
- **`provider-app/`**: Expo React Native application for service providers.
- **`supabase/`**: Supabase migrations, configurations, and Deno Edge Functions.

### Directory Mapping & Presentation Layer Files

```
REPARAÍ/
├── client-app/                  # Client Expo App
│   ├── assets/                  # Shared image and font assets
│   └── src/
│       ├── app/                 # Expo Router Navigation Layer
│       │   ├── (tabs)/          # Main Tab Navigator
│       │   │   ├── _layout.tsx
│       │   │   ├── home.tsx     # Client Dashboard (Category selection & Mode selection)
│       │   │   ├── search.tsx   # Provider / Service manual search
│       │   │   ├── requests.tsx # Active and past request tickets
│       │   │   ├── notifications.tsx # Client notification center
│       │   │   └── profile.tsx  # Profile settings, Saved addresses, Payment methods
│       │   ├── profile/         # Profile sub-routes
│       │   │   ├── edit.tsx     # Client profile editor
│       │   │   ├── help.tsx     # Help center & customer support
│       │   │   └── payments.tsx # Payment methods management
│       │   ├── provider/        # Provider display routes
│       │   │   ├── [id].tsx     # Provider public profile & highlights detail
│       │   │   └── highlight-checkout.tsx # Booking checkout directly from provider page
│       │   ├── request/new/     # Request/Order Creation Funnel
│       │   │   ├── index.tsx    # Category/Domain select screen
│       │   │   ├── describe.tsx # Problem description editor (Photo/Audio attachment)
│       │   │   ├── interactive-form.tsx # Dynamic AI diagnostic question funnel
│       │   │   ├── details.tsx  # Location checkout (Saved addresses, CEP search, map picker)
│       │   │   ├── match.tsx    # Live pulsing radar & matchmaking bidding screen
│       │   │   └── checkout.tsx # Displacement fee checkout & payment method selector
│       │   ├── ticket/
│       │   │   └── [id].tsx     # Ticket Tracking screen (Live provider tracking map)
│       │   ├── chat/
│       │   │   └── [id].tsx     # Chat Thread with Provider (In-app messaging, reviews)
│       │   ├── index.tsx        # App entry point, redirects to /(tabs)/home
│       │   ├── _layout.tsx      # Main Router root layout
│       │   └── modal.tsx        # General purpose bottom sheets
│       ├── components/          # Reusable UI Components
│       │   ├── modals/          # Modal sheets (Auth, Filter, MapPicker)
│       │   ├── ui/              # Atom level design components (Buttons, Cards, GlassView)
│       │   └── ...
│       ├── context/             # Global Context State (Auth, Location, Request)
│       ├── hooks/               # Custom React Hooks
│       └── services/            # Supabase API services (aiService, chatService)
│
├── provider-app/                # Provider Expo App
│   └── src/
│       ├── app/                 # Expo Router Navigation Layer
│       │   ├── (auth)/          # Authentication flow
│       │   │   ├── _layout.tsx
│       │   │   ├── login.tsx    # OTP login entry
│       │   │   └── verify.tsx   # OTP code verification
│       │   ├── (tabs)/          # Main Tab Navigator
│       │   │   ├── _layout.tsx
│       │   │   ├── jobs.tsx     # Main feed of open requests (online switch)
│       │   │   ├── active.tsx   # Active, completed, and canceled service tracking
│       │   │   ├── chat.tsx     # Chat rooms inbox
│       │   │   └── profile.tsx  # Provider settings and metadata
│       │   ├── auth/
│       │   │   └── callback.tsx # Deep link callback handler
│       │   ├── chat/
│       │   │   └── [id].tsx     # Chat Thread with Client (Icebreaker chips)
│       │   ├── profile/
│       │   │   ├── edit.tsx     # Detailed provider profile and rate settings
│       │   │   └── highlights.tsx # Highlight portfolio and specializations configuration
│       │   ├── jobDetail.tsx    # Detailed page for an open request before bidding
│       │   ├── index.tsx        # Entry point redirect (redirects to jobs or login)
│       │   └── _layout.tsx      # Root Router layout
│       ├── context/             # Global contexts (Auth, Notifications)
│       └── hooks/               # Custom React Hooks (useOpenRequests, useProviderServices)
│
└── supabase/                    # Supabase Backend
    ├── functions/               # Deno Edge Functions
    │   ├── analyze-request/     # Async request analysis (Gemini 2.0 Flash)
    │   └── generate-diagnostic-questions/ # Dynamic Q&A generator (Gemini 2.0 Flash)
    └── migrations/              # Database schema migrations
```

---

## 2. Anatomy (Logic, State & UI)

Every screen is connected to specific data streams, global/local state, and styling patterns.

### A. Presentation & Logic Layer Breakdown

#### 1. Client App Funnel & Screens

| File Path | Data Layer (Supabase / APIs) | State Managed | Styling & UI |
| :--- | :--- | :--- | :--- |
| **`home.tsx`** | None (Static domains feed). | `useRequest` (Start draft), `useLocation` (Coordinates). | Apple-style card grids, horizontal banners, quick-start action buttons. |
| **`interactive-form.tsx`** | Invokes Edge Function `generate-diagnostic-questions` using `aiService`. | `funnelAnswers` (Object), `questionsHistory` (Array), `finalConfidence` (Number). | Progress bar, skeleton placeholders with pulsing animations, option cards. |
| **`details.tsx`** | Reads `saved_addresses` table, queries Correios CEP API via `cepService`. Invokes `submitRequest()` which calls `analyze-request` Edge Function asynchronously. | `description` (Local), `addressDetails` (Local), `LocationContext` (Selected location/CEP validation). | Floating bottom details panel, map layout, input textareas, horizontal saved address chips. |
| **`match.tsx`** | Subscribes to Realtime updates on `provider_offers` table. Polls `partners` table for active geolocation coordinates. | `status` ('finding' \| 'offered'), `assignedProvider` (Provider profile), `offerCandidates` (Bids). | Fullscreen `react-native-maps`, custom map style, radar pulsing animation ring, sliding offer bottom sheet. |
| **`checkout.tsx`** | Invokes RPC function `confirm_order`. | `selectedPayment` ('credit_card' \| 'pix' \| 'cash'). | Structured invoice breakdown, custom radio buttons for payment methods. |
| **`ticket/[id].tsx`** | Subscribes to Realtime updates on `requests` table. Polls and tracks partner displacement from `partners`. Invokes RPC `client_confirm_done`. | `ticket` (Detail data), `provider` (Tracking data), `ratingVisible` (Local modal toggle). | Fullscreen map with OSRM routing dashed-line path, success modal overlay, completion action banners. |
| **`chat/[id].tsx`** | Invokes RPC `send_chat_message_v1`. Inserts reviews via RPC `submit_review`. Subscribes to messages (`type = 'message'` in `notifications` table). | `messages` (Array), `inputText` (String), `reviewRating` (Number), `reviewComment` (String). | Clean messaging bubble log (incoming vs outgoing), timeline status tracker, inline review submission cards. |

#### 2. Provider App Screens

| File Path | Data Layer (Supabase / APIs) | State Managed | Styling & UI |
| :--- | :--- | :--- | :--- |
| **`jobs.tsx`** | Invokes RPC `get_provider_open_requests` inside 5km. Sets online readiness and updates GPS coordinates every 30s via RPC `set_my_partner_location`. Invokes RPC `submit_provider_offer` to bid and `reject_provider_offer` to mute. | `isOnline` (Switch), `requests` (Open requests list), `selectedOfferRequest` (Draft offer). | Linear gradient header dashboard, online switch toggle, floating offer form modal. |
| **`active.tsx`** | Loads active services using `useProviderServices` hook. Invokes RPC `provider_set_en_route` and RPC `provider_confirm_done`. Invokes RPC `submit_review`. | `filter` ('in_progress' \| 'done' \| 'canceled'). | Segmented control buttons, client profile summary cards, action trigger buttons. |
| **`chat/[id].tsx`** | Reads and sends messages using RPC `send_chat_message_v1` (inserts into `notifications` table). | `messages` (Array), `inputText` (String). | Safety banner, suggestion chip blocks (icebreakers). |
| **`profile/edit.tsx`** | Updates profile columns in `partners` table. | Profile details local form. | Simple forms, category selector, fixed vs mobile type picker. |

### B. Supabase Database Schema Spec

The database uses PostgreSQL schema objects with Row Level Security (RLS) enabled on all tables.

```mermaid
erDiagram
    clients {
        uuid id PK
        string full_name
        string phone
        string avatar_url
        timestamp created_at
    }
    partners {
        uuid id PK
        string full_name
        string phone
        string avatar_url
        float rating
        integer reviews_count
        string service_category
        float base_fee
        geography location
        boolean is_online
        string type
        integer operational_score
        string push_token
    }
    requests {
        uuid id PK
        uuid user_id FK
        uuid provider_id FK
        string status
        string category
        string user_text
        string address
        string neighborhood
        string city
        string state
        string street_number
        jsonb answers_json
        jsonb ai_result_json
        float lat
        float lng
        timestamp expires_at
        float displacement_fee
        string payment_method
        string payment_status
        numeric service_quote
        string service_payment_status
        timestamp done_provider_at
        timestamp done_client_at
        timestamp created_at
    }
    provider_offers {
        uuid id PK
        uuid request_id FK
        uuid provider_id FK
        string status
        numeric price
        integer estimated_time
        text message
        timestamp created_at
    }
    notifications {
        uuid id PK
        uuid user_id FK
        string title
        text message
        string type
        uuid related_id
        boolean is_read
        timestamp created_at
    }
    reviews {
        uuid id PK
        uuid request_id FK
        uuid reviewer_id FK
        uuid reviewee_id FK
        string role
        integer rating
        text comment
        timestamp created_at
    }
    saved_addresses {
        uuid id PK
        uuid user_id FK
        string name
        string address
        float latitude
        float longitude
        string street_number
        string neighborhood
        string city
        string state
        string icon
    }

    clients ||--o{ requests : creates
    partners ||--o{ requests : accepts
    requests ||--o{ provider_offers : receives
    partners ||--o{ provider_offers : bids
    requests ||--o{ reviews : reviews
    clients ||--o{ saved_addresses : configures
    requests ||--o{ notifications : triggers
```

---

## 3. The Nervous System (Connections & Flow)

The integration flow combines Expo Router client-side routing, Supabase Realtime synchronization, and transactional RPC handlers.

### A. Client App Navigation Flow

```mermaid
graph TD
    classDef screen fill:#FFF,stroke:#ff7b00,stroke-width:2px;
    classDef modal fill:#FFF7ED,stroke:#F59E0B,stroke-width:1.5px,stroke-dasharray: 5 5;
    
    Start((App Init)) --> Index[app/index.tsx]
    Index --> Home["(tabs)/home.tsx"]:::screen

    %% Home Tab Actions
    Home --> SearchTab["(tabs)/search.tsx"]:::screen
    Home --> RequestsTab["(tabs)/requests.tsx"]:::screen
    Home --> NotificationsTab["(tabs)/notifications.tsx"]:::screen
    Home --> ProfileTab["(tabs)/profile.tsx"]:::screen
    
    ProfileTab --> EditProfile["profile/edit.tsx"]:::screen
    ProfileTab --> HelpCenter["profile/help.tsx"]:::screen
    ProfileTab --> Payments["profile/payments.tsx"]:::screen

    %% Funnel Creation
    Home --> |Selects Category & Mode| ReqNew["request/new/index.tsx"]:::screen
    ReqNew --> ReqDescribe["request/new/describe.tsx"]:::screen
    ReqDescribe --> ReqInteractive["request/new/interactive-form.tsx"]:::screen
    
    %% AI Generation inside Funnel
    ReqInteractive --> |Edge Function Questions| ReqInteractive
    ReqInteractive --> |On High Confidence| ReqDetails["request/new/details.tsx"]:::screen
    
    ReqDetails -.-> SavedAddresses["SavedAddressesList"]:::modal
    ReqDetails -.-> MapPicker["MapPickerModal"]:::modal
    ReqDetails -.-> AuthSheet["AuthBottomSheet (Gatekeeper)"]:::modal
    
    ReqDetails --> |Submit finding| ReqMatch["request/new/match.tsx"]:::screen
    
    %% Match Bidding
    ReqMatch --> |Select Offer| ReqCheckout["request/new/checkout.tsx"]:::screen
    ReqCheckout --> |RPC confirm_order| TicketDetail["ticket/[id].tsx"]:::screen
    
    %% Tracking & Chat
    TicketDetail --> |Open Chat| ChatRoom["chat/[id].tsx"]:::screen
    TicketDetail --> |Provider Arrives| QuoteApproval["Checkout 2: Final Quote"]:::modal
    QuoteApproval --> |done_provider_at & done_client_at| ChatRoom
    ChatRoom --> |RPC submit_review| RatingBubble["Rating Module"]:::modal
    
    linkStyle 0,1,2,3,4,5,6,7,8,9,10,11,12,16,17,19,20 stroke:#ff7b00,stroke-width:2px;
```

### B. Provider App Navigation Flow

```mermaid
graph TD
    classDef screen fill:#FFF,stroke:#0369A1,stroke-width:2px;
    classDef modal fill:#F0FDF4,stroke:#16A34A,stroke-width:1.5px,stroke-dasharray: 5 5;

    PStart((Provider App Init)) --> PIndex[app/index.tsx]
    PIndex --> |No Session| PLogin["(auth)/login.tsx"]:::screen
    PLogin --> PVerify["(auth)/verify.tsx"]:::screen
    
    PVerify --> PJobs["(tabs)/jobs.tsx"]:::screen
    PIndex --> |Has Session| PJobs
    
    %% Tabs Navigation
    PJobs --> PActive["(tabs)/active.tsx"]:::screen
    PJobs --> PChats["(tabs)/chat.tsx"]:::screen
    PJobs --> PProfile["(tabs)/profile.tsx"]:::screen
    
    PProfile --> PEditProfile["profile/edit.tsx"]:::screen
    PProfile --> PHighlights["profile/highlights.tsx"]:::screen

    %% Job Interaction
    PJobs --> |Click Card| PJobDetail["jobDetail.tsx"]:::screen
    PJobDetail --> |Fazer Oferta| PJobs
    PJobs -.-> POfferModal["OfferModal"]:::modal
    
    %% Active Services
    PActive --> |Open Chat| PChatRoom["chat/[id].tsx"]:::screen
    PActive -.-> PRatingModal["RatingModal (Client Review)"]:::modal

    linkStyle 0,1,2,3,4,5,6,7,8,9,10,11,12,13 stroke:#0369A1,stroke-width:2px;
```

### C. End-to-End Architecture Sequence & Data Lifecycle

The following sequence details how the frontend applications communicate with Supabase, Gemini Edge Functions, and how data syncs in Realtime.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client App
    participant EdgeQ as Edge: generate-questions
    participant DB as Supabase DB
    participant RT as Supabase Realtime
    actor Provider as Provider App
    participant EdgeA as Edge: analyze-request

    %% 1. Interactive Diagnostic Funnel
    Note over Client, EdgeQ: 1. Diagnostic Q&A Funnel
    Client->>EdgeQ: invoke('generate-diagnostic-questions', { category, answers, userText })
    EdgeQ->>EdgeQ: Queries Gemini 2.0 Flash
    EdgeQ-->>Client: Returns DiagnosticQuestion[] & confidence score
    Note over Client: Repeat step 1-3 until confidence >= 0.7 or max 5 questions

    %% 2. Request Submission
    Note over Client, DB: 2. Request Submission
    Client->>DB: INSERT into requests (status: 'finding', answers_json)
    DB-->>Client: Returns requestId
    Client->>EdgeA: invoke('analyze-request', { requestId, answers, userText, lat, lng })
    Note over Client: Redirects to request/new/match
    
    %% 3. Async Analysis & Taxonomy Matchmaking
    Note over EdgeA, DB: 3. Async AI Taxonomy Extraction
    activate EdgeA
    EdgeA->>EdgeA: Queries Gemini 2.0 Flash for 3D Taxonomy
    EdgeA->>DB: UPDATE requests SET domain_slug, asset_slug, service_type_slug, issue_tags, ai_result_json
    deactivate EdgeA
    
    %% 4. Provider Feed & Offers
    Note over Provider, DB: 4. Provider Discovery & Bidding
    Provider->>DB: RPC set_my_partner_location(lat, lng) [Runs every 30s]
    Provider->>DB: RPC get_provider_open_requests(radius_km: 5) [Polls nearby 'finding' requests]
    DB-->>Provider: Returns nearby matching requests
    Provider->>DB: RPC submit_provider_offer(requestId, price, estimated_time, message)
    DB->>DB: Inserts provider_offers row (status: 'offered') & sets requests status to 'offered'
    
    %% 5. Bidding Realtime Sync
    Note over DB, Client: 5. Bidding Sync
    DB->>RT: Emit UPDATE on provider_offers / requests
    RT-->>Client: Receive offer details in match.tsx (Realtime Channel)
    Client->>DB: RPC confirm_order(requestId, offerId, paymentMethod)
    DB->>DB: Updates requests status to 'paid', selected offer to 'accepted', other offers to 'declined'
    DB->>DB: Inserts notification row (type: 'request')
    DB->>RT: Emit UPDATE status = 'paid'

    %% 6. Service Execution & Chat
    Note over Client, Provider: 6. Realtime Service Tracking & Chat
    RT-->>Client: Redirects to ticket/[id]
    RT-->>Provider: Moves job to active tab
    
    Client->>DB: RPC send_chat_message_v1(message)
    DB->>DB: Inserts two rows into notifications (type: 'message', sender & recipient)
    DB->>RT: Emit INSERT on notifications
    RT-->>Provider: Shows message in provider chat thread
    
    Provider->>DB: RPC provider_set_en_route(requestId)
    DB->>RT: Emit UPDATE status = 'en_route'
    RT-->>Client: Updates map view in ticket/[id] (Provider moving)
    
    Provider->>DB: RPC provider_set_arrived(requestId)
    DB->>RT: Emit UPDATE status = 'arrived'
    
    Provider->>DB: RPC provider_submit_quote(requestId, quote_price)
    DB->>RT: Emit UPDATE status = 'quote_provided', service_quote
    Client->>DB: RPC client_accept_quote(requestId, paymentMethod)
    DB->>RT: Emit UPDATE status = 'quote_accepted', service_payment_status = 'paid'

    %% 7. Completion & Review
    Note over Provider, Client: 7. Completion Flow & Unhappy Paths
    Provider->>DB: RPC provider_confirm_done(requestId) [done_provider_at = NOW()]
    Client->>DB: RPC client_confirm_done(requestId) [done_client_at = NOW()]
    DB->>DB: Trigger enforce_request_rules updates requests status = 'done'
    DB->>RT: Emit UPDATE status = 'done'
    
    Note over Provider, Client: Disputed State Fallback
    Client->>DB: RPC client_dispute_job(requestId, reason)
    DB->>RT: Emit UPDATE status = 'disputed'
    
    Client->>DB: RPC submit_review(rating, comment) -> inserts into reviews table
    DB->>DB: Trigger recalc_partner_rating recalculates partner avg rating
```

---

## 4. Architectural Rules & Maintenance (The Blueprint Guarantee)

To maintain synchronization between the code documentation and codebase implementation, the following guidelines must be followed:

1. **No Out-of-App Communication**: The chat services (`chatService.ts` and `providerChatService.ts`) actively block off-platform links, email addresses, and phone numbers (`hasExternalContactSignal`) for safety. The blueprint must continue to document this gatekeeping behavior.
2. **Deterministic Matching**: The system depends on the 3D taxonomy (Domain, Asset, Service type) extracted by Gemini. Changing these fields requires upgrading the `requests` table schema and updating both the Edge Function instructions and this blueprint spec.
3. **Database Integrity**: Requests cannot skip statuses. Status progression is strictly validated by the database trigger `enforce_request_rules`. Any new client features introducing new states must modify this PG function first.
4. **Realtime Priority**: Notifications (`notifications` table) double as Chat messages (`type = 'message'`). Modifying the notification schema impacts the chat room history log and unread counts.
