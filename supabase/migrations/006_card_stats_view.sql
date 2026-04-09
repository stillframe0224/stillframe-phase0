-- Card statistics view for KR4 tracking (Phase0 OKR: Cards ≥ 100)

CREATE OR REPLACE VIEW public.card_stats AS
SELECT
  COUNT(*)::int AS total_cards,
  COUNT(DISTINCT user_id)::int AS total_users,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS cards_today,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS cards_this_week,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS cards_this_month
FROM public.cards;

COMMENT ON VIEW public.card_stats IS 'Phase0 KR4 progress: aggregate card creation metrics';

-- Grant access to authenticated users
GRANT SELECT ON public.card_stats TO authenticated;
GRANT SELECT ON public.card_stats TO anon;

-- Per-user card count (for leaderboard / debugging)
CREATE OR REPLACE VIEW public.card_counts_by_user AS
SELECT
  user_id,
  COUNT(*)::int AS card_count,
  MIN(created_at) AS first_card_at,
  MAX(created_at) AS last_card_at
FROM public.cards
GROUP BY user_id
ORDER BY card_count DESC;

COMMENT ON VIEW public.card_counts_by_user IS 'Per-user card counts for debugging and leaderboard';

-- Grant access to authenticated users only (privacy)
GRANT SELECT ON public.card_counts_by_user TO authenticated;
