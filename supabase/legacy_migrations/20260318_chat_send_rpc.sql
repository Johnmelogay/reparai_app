-- ===========================================================
-- Chat Send RPC Hardening
-- Created: 2026-03-18
-- Purpose:
-- 1) Provide a single reliable, RLS-safe chat send path
-- 2) Guarantee authenticated role can insert notifications when needed
-- ===========================================================

-- Defensive grants (RLS still enforced)
GRANT SELECT, INSERT, UPDATE ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.requests TO authenticated;

-- Ensure notifications insert policy exists and is permissive for authenticated inserts.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Authenticated can insert notifications'
  ) THEN
    CREATE POLICY "Authenticated can insert notifications"
      ON public.notifications
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_message_v1(
  p_request_id UUID,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  request_row RECORD;
  recipient_uid UUID;
  normalized_status TEXT;
  sanitized_message TEXT;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  sanitized_message := regexp_replace(trim(COALESCE(p_message, '')), '\s+', ' ', 'g');

  IF sanitized_message = '' THEN
    RAISE EXCEPTION 'Message is empty';
  END IF;

  IF char_length(sanitized_message) > 1000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;

  SELECT r.id, r.user_id, r.provider_id, r.status
  INTO request_row
  FROM public.requests r
  WHERE r.id = p_request_id;

  IF request_row IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF request_row.provider_id IS NULL THEN
    RAISE EXCEPTION 'Request has no provider assigned';
  END IF;

  IF current_uid <> request_row.user_id AND current_uid <> request_row.provider_id THEN
    RAISE EXCEPTION 'Not allowed to message this request';
  END IF;

  normalized_status := lower(COALESCE(request_row.status, ''));
  IF normalized_status NOT IN ('accepted', 'paid', 'en_route', 'completed') THEN
    RAISE EXCEPTION 'Chat unavailable for current request status';
  END IF;

  recipient_uid := CASE
    WHEN current_uid = request_row.user_id THEN request_row.provider_id
    ELSE request_row.user_id
  END;

  INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
  VALUES
    (
      current_uid,
      format('chat:v1:request:%s:%s', current_uid, recipient_uid),
      sanitized_message,
      'message',
      p_request_id,
      true
    ),
    (
      recipient_uid,
      format('chat:v1:request:%s:%s', current_uid, recipient_uid),
      sanitized_message,
      'message',
      p_request_id,
      false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_message_v1(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_chat_message_v1(UUID, TEXT) TO authenticated;

