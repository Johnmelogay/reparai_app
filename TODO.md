# TODO

## Supabase
- [ ] Confirm Supabase URL/anon key are set for Expo (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- [ ] Define/update schema + policies for core tables (users/clients/providers/requests/offers/notifications/addresses).
- [ ] Wire CEP saved addresses to Supabase (replace mocks in `src/services/cepService.ts`).
- [ ] Validate Auth flows (OTP + OAuth) and session restore in `src/context/AuthContext.tsx`.
- [ ] Verify request lifecycle + realtime subscriptions in `src/context/RequestContext.tsx`.
- [ ] Verify matching flow and RPCs (`choose_provider`, `get_map_partners_v2`).
- [ ] Validate notifications CRUD + realtime in `src/hooks/useNotifications.ts`.
- [ ] Confirm AI edge functions are deployed and reachable.

## App
- [ ] Smoke test iOS simulator build (auth, create request, match, cancel).
- [ ] Smoke test Android emulator build.
- [ ] Review error handling/logging for Supabase failures.

