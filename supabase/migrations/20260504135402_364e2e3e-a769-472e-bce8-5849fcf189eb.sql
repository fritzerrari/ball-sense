-- Coach-KI-Inbox
CREATE TABLE public.coach_inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  match_id uuid,
  player_id uuid,
  category text NOT NULL CHECK (category IN ('praise','warning','tactic','fitness','development','admin')),
  title text NOT NULL,
  body text NOT NULL,
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  action_url text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','done','dismissed')),
  source text NOT NULL DEFAULT 'ai',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coach_inbox_club_status ON public.coach_inbox_items(club_id, status, created_at DESC);
CREATE INDEX idx_coach_inbox_match ON public.coach_inbox_items(match_id);

ALTER TABLE public.coach_inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members read inbox"
  ON public.coach_inbox_items FOR SELECT
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Club members update inbox"
  ON public.coach_inbox_items FOR UPDATE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Club members insert inbox"
  ON public.coach_inbox_items FOR INSERT
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Club members delete inbox"
  ON public.coach_inbox_items FOR DELETE
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_coach_inbox_updated
  BEFORE UPDATE ON public.coach_inbox_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Parent Subscriptions (Push)
CREATE TABLE public.parent_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  club_id uuid NOT NULL,
  parent_email text NOT NULL,
  parent_name text,
  manage_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  push_endpoint text,
  push_p256dh text,
  push_auth text,
  notify_on jsonb NOT NULL DEFAULT '{"matches":true,"goals":true,"achievements":true}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, parent_email)
);
CREATE INDEX idx_parent_subs_player ON public.parent_subscriptions(player_id) WHERE active = true;
CREATE INDEX idx_parent_subs_token ON public.parent_subscriptions(manage_token);

ALTER TABLE public.parent_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members read parent subs"
  ON public.parent_subscriptions FOR SELECT
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Club members manage parent subs"
  ON public.parent_subscriptions FOR ALL
  USING (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Public insert parent subs"
  ON public.parent_subscriptions FOR INSERT
  WITH CHECK (true);

CREATE TRIGGER trg_parent_subs_updated
  BEFORE UPDATE ON public.parent_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Parent Notifications Log
CREATE TABLE public.parent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.parent_subscriptions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  match_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed','expired')),
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_parent_notifs_sub ON public.parent_notifications(subscription_id, sent_at DESC);

ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members read parent notifs"
  ON public.parent_notifications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.parent_subscriptions ps
    WHERE ps.id = subscription_id
      AND (ps.club_id = public.get_user_club_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  ));