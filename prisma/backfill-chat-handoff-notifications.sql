UPDATE public.notifications AS notification
SET chat_thread_id = (
  SELECT handoff.thread_id
  FROM public.chat_handoffs AS handoff
  WHERE handoff.user_id = notification.actor_id
    AND handoff.created_at <= notification.created_at + INTERVAL '5 seconds'
  ORDER BY handoff.created_at DESC
  LIMIT 1
)
WHERE notification.type = 'chat_handoff'
  AND notification.chat_thread_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.chat_handoffs AS handoff
    WHERE handoff.user_id = notification.actor_id
      AND handoff.created_at <= notification.created_at + INTERVAL '5 seconds'
  );
