-- Reschedule 77 active sequences to business hours
-- Batch 1 (first 25): 9:00 AM EST Jan 23 = 1769194800
-- Batch 2 (next 25): 9:30 AM EST Jan 23 = 1769196600
-- Batch 3 (last 27): 10:00 AM EST Jan 23 = 1769198400

UPDATE subscriber_sequences
SET next_step_scheduled_at = 1769194800
WHERE status = 'active'
AND id IN (
  SELECT id FROM subscriber_sequences WHERE status = 'active' ORDER BY created_at LIMIT 25
);

UPDATE subscriber_sequences
SET next_step_scheduled_at = 1769196600
WHERE status = 'active'
AND id IN (
  SELECT id FROM subscriber_sequences WHERE status = 'active' ORDER BY created_at LIMIT 25 OFFSET 25
);

UPDATE subscriber_sequences
SET next_step_scheduled_at = 1769198400
WHERE status = 'active'
AND id IN (
  SELECT id FROM subscriber_sequences WHERE status = 'active' ORDER BY created_at LIMIT 27 OFFSET 50
);
