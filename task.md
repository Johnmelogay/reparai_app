# REPARAÍ MVP — Task List

## Phase 1 — Database cleanup and reconciliation
- [x] Confirm no real active requests (all are test data from March)
- [x] Compare `partner_highlights` schema with migration file (match confirmed)
- [x] Verify `fix_review_roles_swap` scope (data-only update, 3 reviews exist, all test data)
- [x] Create discrete maintenance script `scripts/maintenance/cleanup_test_data_20260829.sql`
- [x] Create test seed script `supabase/seed/test_verified_providers.sql`

## Phase 2 — Consolidated migration: confirmed + quote flow + security (Hardened & Audited)
- [x] Draft `supabase/migrations/20260829000200_mvp_consolidated.sql`

## Phase 3 — Isolated Dry-Run on Preview Branch (COMPLETED 100%)
- [x] Created ephemeral Supabase preview branch `mvp-migration-dryrun` (`vespwfmsopnefntovitr`)
- [x] Verified pre-execution isolation metrics (`current_database = postgres`, `requests = 7`, `partners = 2`)
- [x] Executed `cleanup_test_data_20260829.sql` (exit code 0, 0 errors)
- [x] Applied `20260829000200_mvp_consolidated.sql` (exit code 0, 0 errors)
- [x] Applied `test_verified_providers.sql` (exit code 0, 0 errors)
- [x] Verified all invariants:
  - [x] 0 `paid` or `completed` requests remain
  - [x] 0 direct `UPDATE` policies on `requests`
  - [x] Only safe `submit_review` signatures remain
  - [x] Single enabled trigger `trg_enforce_request_rules` on `requests`
  - [x] `provider_offers` CHECK constraint accepts `canceled`
- [x] Executed comprehensive test suites:
  - [x] Test Suite 1: Unverified provider blocked from feed and offers (Passed)
  - [x] Test Suite 2: Full lifecycle `finding -> confirmed -> en_route -> arrived -> quote_provided -> quote_accepted -> done` (Passed)
  - [x] Test Suite 2: Dual confirmation auto-promoted status to `done` (Passed)
  - [x] Test Suite 2: Unauthorized participant rejected on review (Passed)
  - [x] Test Suite 3: Client cancellation flow & notifications (Passed)
  - [x] Test Suite 4: Invalid price/ETA rollback enforcement (Passed)

## Phase 4 — Frontend updates (COMPLETED 100%)
- [x] Update `TicketStatus` type in client-app and provider-app
- [x] Update `STATUS_CONFIG` in `ticket/[id].tsx`
- [x] Add quote approval UI in `ticket/[id].tsx`
- [x] Refactor `active.tsx` to use new RPCs (remove direct updates)
- [x] Refactor `chat/[id].tsx` to use `client_confirm_done` and `submit_review` RPCs
- [x] Refactor `RequestContext.tsx` cancel flow to use `client_cancel_request` RPC
- [x] Rename checkout semantics (remove fake payment language)
- [x] Verified zero direct `requests.update` in frontend apps
- [x] Verified canonical 3-argument `submit_review` across all frontend screens
- [x] Both `client-app` and `provider-app` pass TypeScript (`tsc --noEmit`) and ESLint with 0 errors

## Phase 5 — Testing
- [ ] End-to-end test with two accounts, no manual DB edits

## Phase 6 — Pre-pilot (before external users)
- [ ] Implement admin verification workflow
- [ ] Add push notifications
