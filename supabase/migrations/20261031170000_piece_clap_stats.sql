-- Clap totals for a piece, summed in the database instead of shipping every row to the app.
CREATE OR REPLACE FUNCTION public.piece_clap_stats(p_piece uuid)
RETURNS TABLE (total bigint, supporters bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(sum(count), 0)::bigint, count(*)::bigint
  FROM public.piece_claps WHERE piece_id = p_piece;
$$;
REVOKE EXECUTE ON FUNCTION public.piece_clap_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.piece_clap_stats(uuid) TO service_role;
