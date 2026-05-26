UPDATE public.chat_messages AS message
SET sender_user_id = handoff.user_id
FROM public.chat_handoffs AS handoff
WHERE message.thread_id = handoff.thread_id
  AND message.role = 'user'
  AND message.sender_user_id IS NULL;

UPDATE public.chat_messages AS message
SET sender_user_id = handoff.replied_by_user_id
FROM public.chat_handoffs AS handoff
WHERE message.thread_id = handoff.thread_id
  AND message.role = 'assistant'
  AND message.sender_user_id IS NULL
  AND handoff.replied_by_user_id IS NOT NULL
  AND handoff.admin_reply IS NOT NULL
  AND message.content = handoff.admin_reply;
