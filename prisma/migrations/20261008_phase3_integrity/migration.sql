-- Phase 3: make verification decisions and the event ledger append-only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VerificationLog_rejection_note_check'
  ) THEN
    ALTER TABLE "VerificationLog"
      ADD CONSTRAINT "VerificationLog_rejection_note_check"
      CHECK (
        "decision" <> 'REJECTED'
        OR length(trim(coalesce("rejectionNote", ''))) >= 10
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_verification_logs_one_approval"
  ON "VerificationLog" ("orderId")
  WHERE "decision" = 'APPROVED';

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS "VerificationLog_immutable" ON "VerificationLog";
CREATE TRIGGER "VerificationLog_immutable"
  BEFORE UPDATE OR DELETE ON "VerificationLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS "OrderEvent_immutable" ON "OrderEvent";
CREATE TRIGGER "OrderEvent_immutable"
  BEFORE UPDATE OR DELETE ON "OrderEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
