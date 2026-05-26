ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS chat_thread_id BIGINT
  REFERENCES public.chat_threads(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_chat_thread_id
  ON public.notifications (chat_thread_id);
