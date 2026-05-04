ALTER TABLE public.coach_inbox_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_inbox_items;