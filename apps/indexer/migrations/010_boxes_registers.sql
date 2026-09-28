-- Fleet/Nautilus signing needs node additionalRegisters on the box row.
-- Writer = indexer (block outputs). GET / GQL is SELECT only. Do not invent.

ALTER TABLE boxes
  ADD COLUMN IF NOT EXISTS additional_registers JSONB;

COMMENT ON COLUMN boxes.additional_registers IS
  'Node additionalRegisters (R4–R9). Writer = indexer. Readers SELECT only.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbit_gql') THEN
    GRANT SELECT ON TABLE address_summary TO orbit_gql;
  END IF;
END $$;
