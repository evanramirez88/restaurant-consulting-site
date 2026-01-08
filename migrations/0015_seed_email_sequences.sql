-- R&G Consulting - Seed Email Sequences
-- Migration: 0015_seed_email_sequences.sql
-- Created: 2026-01-08
--
-- Pre-built email sequences for:
-- 1. Toast Support Plan (cold outreach to Toast users)
-- 2. Toast Referral Program
-- 3. Remote Menu Work
-- 4. Booking Confirmation
-- 5. Post-Meeting Follow-up
-- 6. No-Show Re-engagement

-- ============================================
-- TOAST SUPPORT PLAN SEQUENCE (5 emails, 21 days)
-- Target: Toast users who could benefit from support plans
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_toast_support_001',
  'Toast Support Plan Outreach',
  'toast-support-plan',
  'Cold outreach sequence for Toast restaurant users highlighting the value of ongoing support plans',
  'drip',
  'active',
  'America/New_York',
  '["toast", "cold-outreach", "support-plan"]'
);

-- Step 1: Day 0 - Pain point intro
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_toast_support_001_1',
  'seq_toast_support_001',
  1,
  'Pain Point - POS Downtime',
  0,
  'hours',
  'What happens when Toast goes down?',
  '<p>Hi {{first_name}},</p>
<p>Running a restaurant is hard enough without technology issues. When your POS goes down during a Friday night rush, every minute costs real money.</p>
<p>I help Toast restaurant owners like you avoid those nightmare scenarios with proactive support and rapid response when issues arise.</p>
<p>Quick question: When was the last time a tech issue disrupted your service?</p>
<p>Best,<br>Evan<br>R&G Consulting</p>
<p style="font-size: 12px; color: #666;">Reply to share your experience, or <a href="{{unsubscribe_url}}">unsubscribe</a></p>',
  'Hi {{first_name}},

Running a restaurant is hard enough without technology issues. When your POS goes down during a Friday night rush, every minute costs real money.

I help Toast restaurant owners like you avoid those nightmare scenarios with proactive support and rapid response when issues arise.

Quick question: When was the last time a tech issue disrupted your service?

Best,
Evan
R&G Consulting

Reply to share your experience, or unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 2: Day 3 - Case study
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_toast_support_001_2',
  'seq_toast_support_001',
  2,
  'Case Study - Cape Cod Success',
  3,
  'days',
  'How a Cape Cod restaurant saved $4,000 in one weekend',
  '<p>Hi {{first_name}},</p>
<p>Last month, a restaurant in Hyannis called me at 5pm on a Friday. Their Toast terminal froze mid-service.</p>
<p>Because they had our support plan, I was already monitoring their system and had a backup solution ready. They were back online in 12 minutes instead of waiting until Monday for Toast support.</p>
<p>The owner estimated that quick fix saved them over $4,000 in lost sales.</p>
<p>Would a safety net like that be valuable for {{company}}?</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Last month, a restaurant in Hyannis called me at 5pm on a Friday. Their Toast terminal froze mid-service.

Because they had our support plan, I was already monitoring their system and had a backup solution ready. They were back online in 12 minutes instead of waiting until Monday for Toast support.

The owner estimated that quick fix saved them over $4,000 in lost sales.

Would a safety net like that be valuable for {{company}}?

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 3: Day 7 - Educational
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_toast_support_001_3',
  'seq_toast_support_001',
  3,
  'Educational - 3 Common Issues',
  7,
  'days',
  '3 Toast issues that cost restaurants the most',
  '<p>Hi {{first_name}},</p>
<p>After helping 50+ Toast restaurants, I see the same issues repeatedly:</p>
<ol>
<li><strong>Menu sync failures</strong> - Items show wrong prices or disappear entirely</li>
<li><strong>KDS connection drops</strong> - Kitchen stops receiving tickets</li>
<li><strong>Payment terminal timeouts</strong> - Cards decline when the issue is actually network-related</li>
</ol>
<p>Most of these are preventable with proper setup and monitoring. The restaurants I support rarely experience these because we catch problems before they impact service.</p>
<p>Have you run into any of these at {{company}}?</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

After helping 50+ Toast restaurants, I see the same issues repeatedly:

1. Menu sync failures - Items show wrong prices or disappear entirely
2. KDS connection drops - Kitchen stops receiving tickets
3. Payment terminal timeouts - Cards decline when the issue is actually network-related

Most of these are preventable with proper setup and monitoring. The restaurants I support rarely experience these because we catch problems before they impact service.

Have you run into any of these at {{company}}?

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 4: Day 14 - ROI calculation
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_toast_support_001_4',
  'seq_toast_support_001',
  4,
  'ROI Calculation',
  14,
  'days',
  'The math on Toast support (it might surprise you)',
  '<p>Hi {{first_name}},</p>
<p>Quick comparison for you:</p>
<p><strong>Without a support plan:</strong></p>
<ul>
<li>Emergency Toast support: $175/hour</li>
<li>Average response time: 24-48 hours</li>
<li>Lost sales during downtime: $500-$2,000+</li>
</ul>
<p><strong>With our Professional plan ($500/month):</strong></p>
<ul>
<li>Response time: Under 30 minutes</li>
<li>Monthly menu updates included</li>
<li>Proactive monitoring catches issues before they hit</li>
</ul>
<p>One prevented service disruption pays for 2-3 months of coverage.</p>
<p>Want to see if this makes sense for {{company}}? Happy to run through the numbers on a quick call.</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Quick comparison for you:

Without a support plan:
- Emergency Toast support: $175/hour
- Average response time: 24-48 hours
- Lost sales during downtime: $500-$2,000+

With our Professional plan ($500/month):
- Response time: Under 30 minutes
- Monthly menu updates included
- Proactive monitoring catches issues before they hit

One prevented service disruption pays for 2-3 months of coverage.

Want to see if this makes sense for {{company}}? Happy to run through the numbers on a quick call.

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 5: Day 21 - Breakup
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_toast_support_001_5',
  'seq_toast_support_001',
  5,
  'Breakup Email',
  21,
  'days',
  'Should I close your file?',
  '<p>Hi {{first_name}},</p>
<p>I have not heard back from you, so I am guessing one of three things:</p>
<ol>
<li>You are all set with Toast support</li>
<li>This is not a priority right now</li>
<li>You have been busy (totally understand - restaurants never slow down)</li>
</ol>
<p>If option 1 or 2, no worries at all - I will stop reaching out.</p>
<p>If option 3 and you would like to chat when things settle down, just reply and I will follow up later.</p>
<p>Either way, wishing you a great season at {{company}}.</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

I have not heard back from you, so I am guessing one of three things:

1. You are all set with Toast support
2. This is not a priority right now
3. You have been busy (totally understand - restaurants never slow down)

If option 1 or 2, no worries at all - I will stop reaching out.

If option 3 and you would like to chat when things settle down, just reply and I will follow up later.

Either way, wishing you a great season at {{company}}.

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- ============================================
-- REMOTE MENU WORK SEQUENCE (4 emails, 10 days)
-- Target: Restaurants needing menu updates
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_menu_work_001',
  'Remote Menu Work Outreach',
  'remote-menu-work',
  'Outreach sequence for remote menu building and update services',
  'drip',
  'active',
  'America/New_York',
  '["menu", "remote-work", "quick-win"]'
);

-- Step 1: Quick win intro
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_menu_001_1',
  'seq_menu_work_001',
  1,
  'Quick Win Intro',
  0,
  'hours',
  'Menu update in 48 hours',
  '<p>Hi {{first_name}},</p>
<p>Updating your Toast menu should not take a week of back-and-forth with support.</p>
<p>I help restaurants like {{company}} get menu changes done in 48 hours or less - new items, price updates, modifier fixes, whatever you need.</p>
<p>Flat rate: $800 for up to 100 items. No hourly billing, no surprises.</p>
<p>Got any menu updates that have been sitting on your to-do list?</p>
<p>Best,<br>Evan<br>R&G Consulting</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Updating your Toast menu should not take a week of back-and-forth with support.

I help restaurants like {{company}} get menu changes done in 48 hours or less - new items, price updates, modifier fixes, whatever you need.

Flat rate: $800 for up to 100 items. No hourly billing, no surprises.

Got any menu updates that have been sitting on your to-do list?

Best,
Evan
R&G Consulting

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 2: Before/after
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_menu_001_2',
  'seq_menu_work_001',
  2,
  'Before/After Example',
  3,
  'days',
  'How a 200-item menu got organized in one day',
  '<p>Hi {{first_name}},</p>
<p>Last week a bar owner sent me their "mess of a menu" - 200+ items, duplicates everywhere, modifiers that made no sense to the kitchen.</p>
<p>By the next morning, they had:</p>
<ul>
<li>Clean categories that matched their physical menu</li>
<li>Modifiers that actually printed correctly on tickets</li>
<li>Happy hour pricing that activated automatically</li>
</ul>
<p>Total time from "this is a disaster" to "this is perfect": 8 hours.</p>
<p>Would a menu cleanup like that help at {{company}}?</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Last week a bar owner sent me their "mess of a menu" - 200+ items, duplicates everywhere, modifiers that made no sense to the kitchen.

By the next morning, they had:
- Clean categories that matched their physical menu
- Modifiers that actually printed correctly on tickets
- Happy hour pricing that activated automatically

Total time from "this is a disaster" to "this is perfect": 8 hours.

Would a menu cleanup like that help at {{company}}?

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- ============================================
-- BOOKING CONFIRMATION SEQUENCE (for Cal.com)
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_booking_confirm_001',
  'Booking Confirmation',
  'booking-confirmation',
  'Automated confirmation and reminder sequence for Cal.com bookings',
  'transactional',
  'active',
  'America/New_York',
  '["booking", "transactional", "calcom"]'
);

-- Immediate confirmation
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_booking_001_1',
  'seq_booking_confirm_001',
  1,
  'Immediate Confirmation',
  0,
  'minutes',
  'Your consultation is confirmed',
  '<p>Hi {{first_name}},</p>
<p>Thanks for booking a consultation with me. I am looking forward to learning about {{company}} and how I can help.</p>
<p><strong>Details:</strong></p>
<ul>
<li>When: {{meeting_time}}</li>
<li>Where: {{meeting_url}}</li>
</ul>
<p>To get the most out of our time together, consider having these handy:</p>
<ul>
<li>Your current menu (physical or digital)</li>
<li>Any specific Toast issues you have been experiencing</li>
<li>Questions about your setup or workflow</li>
</ul>
<p>See you soon!</p>
<p>Best,<br>Evan<br>R&G Consulting</p>',
  'Hi {{first_name}},

Thanks for booking a consultation with me. I am looking forward to learning about {{company}} and how I can help.

Details:
- When: {{meeting_time}}
- Where: {{meeting_url}}

To get the most out of our time together, consider having these handy:
- Your current menu (physical or digital)
- Any specific Toast issues you have been experiencing
- Questions about your setup or workflow

See you soon!

Best,
Evan
R&G Consulting',
  'Evan from R&G Consulting',
  'active'
);

-- ============================================
-- POST-MEETING FOLLOW-UP SEQUENCE
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_post_meeting_001',
  'Post-Meeting Follow-up',
  'post-meeting-followup',
  'Follow-up sequence after consultation calls',
  'behavior',
  'active',
  'America/New_York',
  '["meeting", "follow-up", "calcom"]'
);

-- Thank you email (immediate)
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_post_meeting_001_1',
  'seq_post_meeting_001',
  1,
  'Thank You',
  0,
  'minutes',
  'Great talking with you, {{first_name}}',
  '<p>Hi {{first_name}},</p>
<p>Thanks for taking the time to chat today. I enjoyed learning about {{company}} and the challenges you are facing.</p>
<p>As discussed, here are the next steps:</p>
<p>[I will customize this based on our conversation]</p>
<p>If any questions come up before we connect again, just reply to this email.</p>
<p>Best,<br>Evan</p>',
  'Hi {{first_name}},

Thanks for taking the time to chat today. I enjoyed learning about {{company}} and the challenges you are facing.

As discussed, here are the next steps:
[I will customize this based on our conversation]

If any questions come up before we connect again, just reply to this email.

Best,
Evan',
  'Evan from R&G Consulting',
  'active'
);

-- ============================================
-- NO-SHOW RE-ENGAGEMENT SEQUENCE
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_noshow_001',
  'No-Show Re-engagement',
  'noshow-reengagement',
  'Re-engagement sequence for missed appointments',
  'behavior',
  'active',
  'America/New_York',
  '["noshow", "reengagement", "calcom"]'
);

-- We missed you (immediate)
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_noshow_001_1',
  'seq_noshow_001',
  1,
  'We Missed You',
  0,
  'minutes',
  'We missed you today',
  '<p>Hi {{first_name}},</p>
<p>I had our call on my calendar but did not see you join. No worries - I know restaurants get crazy and things come up.</p>
<p>Would you like to reschedule? Just reply with a time that works better, or use my calendar link:</p>
<p><a href="https://cal.com/r-g-consulting">Book a new time</a></p>
<p>Best,<br>Evan</p>',
  'Hi {{first_name}},

I had our call on my calendar but did not see you join. No worries - I know restaurants get crazy and things come up.

Would you like to reschedule? Just reply with a time that works better, or use my calendar link:
https://cal.com/r-g-consulting

Best,
Evan',
  'Evan from R&G Consulting',
  'active'
);
