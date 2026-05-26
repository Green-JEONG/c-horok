ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sender_user_id BIGINT
  REFERENCES public.users(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_user_id
  ON public.chat_messages (sender_user_id);
