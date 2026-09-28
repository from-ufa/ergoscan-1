-- Slim tape of token *moves* (per-address net <> 0). Not an UPDATE of 35 GB token_tx_seen.
-- Index is 037 CONCURRENTLY. Trigger fills new token_tx_seen inserts; history via ingest_page.

CREATE TABLE IF NOT EXISTS token_tx_move (
  token_id   TEXT NOT NULL,
  tx_id      TEXT NOT NULL,
  height     BIGINT,
  created    NUMERIC NOT NULL DEFAULT 0,
  spent      NUMERIC NOT NULL DEFAULT 0,
  moved      NUMERIC NOT NULL DEFAULT 0,
  from_addrs TEXT[] NOT NULL DEFAULT '{}',
  to_addrs   TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (token_id, tx_id),
  FOREIGN KEY (token_id, tx_id) REFERENCES token_tx_seen (token_id, tx_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS token_tx_move_sync (
  token_id  TEXT PRIMARY KEY,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION token_tx_move_fill()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_created numeric := 0;
  v_spent numeric := 0;
  v_moved numeric := 0;
  v_from text[];
  v_to text[];
BEGIN
  WITH created_by AS (
    SELECT b.address, SUM(a.amount) AS got
    FROM boxes b
    JOIN box_assets a ON a.box_id = b.box_id AND a.token_id = NEW.token_id
    WHERE b.creation_tx_id = NEW.tx_id AND b.address IS NOT NULL
    GROUP BY 1
  ),
  spent_by AS (
    SELECT b.address, SUM(a.amount) AS gave
    FROM boxes b
    JOIN box_assets a ON a.box_id = b.box_id AND a.token_id = NEW.token_id
    WHERE b.spent_tx_id = NEW.tx_id AND b.address IS NOT NULL
    GROUP BY 1
  ),
  nets AS (
    SELECT COALESCE(c.address, s.address) AS address,
           COALESCE(c.got, 0) - COALESCE(s.gave, 0) AS net
    FROM created_by c
    FULL JOIN spent_by s ON s.address = c.address
  )
  SELECT
    COALESCE((SELECT SUM(got) FROM created_by), 0),
    COALESCE((SELECT SUM(gave) FROM spent_by), 0),
    COALESCE((SELECT SUM(net) FROM nets WHERE net > 0), 0),
    COALESCE(ARRAY(SELECT n.address FROM nets n WHERE n.net < 0 ORDER BY n.address LIMIT 8), ARRAY[]::text[]),
    COALESCE(ARRAY(
      SELECT n.address FROM nets n
      WHERE n.net > 0
        AND n.address <> '2iHkR7CWvD1R4j1yZg5bkeDRQavjAaVPeTDFGGLZduHyfWMuYpmhHocX8GJoaieTx78FntzJbCBVL6rf96ocJoZdmWBL2fci7NqWgAirppPQmZ7fN9V6z13Ay6brPriBKYqLp1bT2Fk4FkFLCfdPpe'
      ORDER BY n.address LIMIT 8
    ), ARRAY[]::text[])
  INTO v_created, v_spent, v_moved, v_from, v_to;

  IF v_moved = 0 AND v_created = v_spent AND cardinality(v_from) = 0 AND cardinality(v_to) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO token_tx_move (token_id, tx_id, height, created, spent, moved, from_addrs, to_addrs)
  VALUES (NEW.token_id, NEW.tx_id, NEW.height, v_created, v_spent, v_moved, v_from, v_to)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS token_tx_move_tg ON token_tx_seen;
CREATE TRIGGER token_tx_move_tg
AFTER INSERT ON token_tx_seen
FOR EACH ROW
EXECUTE FUNCTION token_tx_move_fill();

CREATE OR REPLACE FUNCTION token_tx_move_ingest_page(
  p_token text,
  p_height bigint,
  p_tx text,
  p_n int
) RETURNS TABLE(n_read int, n_ins int, last_height bigint, last_tx text)
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('enable_hashjoin', 'off', true);
  PERFORM set_config('enable_mergejoin', 'off', true);
  PERFORM set_config('jit', 'off', true);
  PERFORM set_config('plan_cache_mode', 'force_custom_plan', true);

  RETURN QUERY
  WITH page AS (
    SELECT s.tx_id AS id, s.height
    FROM token_tx_seen s
    WHERE s.token_id = p_token
      AND s.height IS NOT NULL
      AND (p_height IS NULL OR s.height <= p_height)
      AND (
        p_height IS NULL
        OR s.height < p_height
        OR (s.height = p_height AND s.tx_id < COALESCE(p_tx, ''))
      )
    ORDER BY s.height DESC NULLS LAST, s.tx_id DESC
    LIMIT p_n
  ),
  created_by AS (
    SELECT b.creation_tx_id AS tx_id, b.address, SUM(a.amount) AS got
    FROM page p
    JOIN boxes b ON b.creation_tx_id = p.id
    JOIN box_assets a ON a.box_id = b.box_id AND a.token_id = p_token
    WHERE b.address IS NOT NULL
    GROUP BY 1, 2
  ),
  spent_by AS (
    SELECT b.spent_tx_id AS tx_id, b.address, SUM(a.amount) AS gave
    FROM page p
    JOIN boxes b ON b.spent_tx_id = p.id
    JOIN box_assets a ON a.box_id = b.box_id AND a.token_id = p_token
    WHERE b.address IS NOT NULL
    GROUP BY 1, 2
  ),
  nets AS (
    SELECT COALESCE(c.tx_id, s.tx_id) AS tx_id,
           COALESCE(c.address, s.address) AS address,
           COALESCE(c.got, 0) - COALESCE(s.gave, 0) AS net
    FROM created_by c
    FULL JOIN spent_by s ON s.tx_id = c.tx_id AND s.address = c.address
  ),
  parts AS (
    SELECT
      n.tx_id,
      COALESCE(SUM(n.net) FILTER (WHERE n.net > 0), 0) AS moved,
      COALESCE(ARRAY_AGG(n.address ORDER BY n.address) FILTER (WHERE n.net < 0), ARRAY[]::text[]) AS from_addrs,
      COALESCE(ARRAY_AGG(n.address ORDER BY n.address) FILTER (
        WHERE n.net > 0 AND n.address <> '2iHkR7CWvD1R4j1yZg5bkeDRQavjAaVPeTDFGGLZduHyfWMuYpmhHocX8GJoaieTx78FntzJbCBVL6rf96ocJoZdmWBL2fci7NqWgAirppPQmZ7fN9V6z13Ay6brPriBKYqLp1bT2Fk4FkFLCfdPpe'
      ), ARRAY[]::text[]) AS to_addrs
    FROM nets n
    GROUP BY n.tx_id
  ),
  created_amt AS (
    SELECT tx_id, SUM(got) AS created FROM created_by GROUP BY 1
  ),
  spent_amt AS (
    SELECT tx_id, SUM(gave) AS spent FROM spent_by GROUP BY 1
  ),
  ins AS (
    INSERT INTO token_tx_move (token_id, tx_id, height, created, spent, moved, from_addrs, to_addrs)
    SELECT p_token, p.id, p.height,
           COALESCE(ca.created, 0), COALESCE(sa.spent, 0), COALESCE(pr.moved, 0),
           COALESCE(pr.from_addrs[1:8], ARRAY[]::text[]),
           COALESCE(pr.to_addrs[1:8], ARRAY[]::text[])
    FROM page p
    LEFT JOIN parts pr ON pr.tx_id = p.id
    LEFT JOIN created_amt ca ON ca.tx_id = p.id
    LEFT JOIN spent_amt sa ON sa.tx_id = p.id
    WHERE COALESCE(pr.moved, 0) <> 0
       OR COALESCE(ca.created, 0) IS DISTINCT FROM COALESCE(sa.spent, 0)
       OR cardinality(COALESCE(pr.from_addrs, ARRAY[]::text[])) > 0
       OR cardinality(COALESCE(pr.to_addrs, ARRAY[]::text[])) > 0
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::int FROM page),
    (SELECT COUNT(*)::int FROM ins),
    (SELECT p.height FROM page p ORDER BY p.height ASC NULLS FIRST, p.id ASC LIMIT 1),
    (SELECT p.id FROM page p ORDER BY p.height ASC NULLS FIRST, p.id ASC LIMIT 1);
END;
$$;
