-- R&G Consulting - Segment-Specific Email Sequences
-- Migration: 0019_segment_email_sequences.sql
-- Created: 2026-01-10
--
-- Email sequences aligned with Sales & Marketing Blueprint v2:
-- Segment A: POS Switchers (Clover/Square/Lightspeed → Toast)
-- Segment C: Ownership Transitions (New owners, restaurant flips)
-- Segment D: Local Network/Infrastructure (Cape Cod + South Shore + SE MA)

-- ============================================
-- SEGMENT A: POS SWITCHER SEQUENCE (4 emails, 15 days)
-- Target: Restaurants on Clover, Square, Lightspeed, TouchBistro
-- Pain: Downtime fears, menu rebuild nightmare, hidden fees
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_pos_switcher_001',
  'POS Switcher Outreach',
  'pos-switcher',
  'Cold outreach for restaurants considering switching from Clover, Square, or other POS to Toast',
  'drip',
  'active',
  'America/New_York',
  '["segment-a", "switcher", "clover", "square", "cold-outreach"]'
);

-- Step 1: Day 0 - Pain point intro (switch anxiety)
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_switcher_001_1',
  'seq_pos_switcher_001',
  1,
  'Switch Anxiety Intro',
  0,
  'hours',
  'Quick question about your POS at {{company}}',
  '<p>Hi {{first_name}},</p>
<p>I help restaurants switch from systems like Clover and Square to Toast without the "menu rebuild nightmare" or downtime surprises.</p>
<p>If you are considering a change this year, I can do a fast Switch Readiness Audit: menu complexity, ordering channels, printers/KDS routing, and a cutover plan that will not wreck service.</p>
<p>Worth a 15-minute call this week?</p>
<p>Best,<br>Evan M. Ramirez<br>R&G Consulting<br>(508) 247-4936</p>
<p style="font-size: 12px; color: #666;">Reply to chat, or <a href="{{unsubscribe_url}}">unsubscribe</a></p>',
  'Hi {{first_name}},

I help restaurants switch from systems like Clover and Square to Toast without the "menu rebuild nightmare" or downtime surprises.

If you are considering a change this year, I can do a fast Switch Readiness Audit: menu complexity, ordering channels, printers/KDS routing, and a cutover plan that will not wreck service.

Worth a 15-minute call this week?

Best,
Evan M. Ramirez
R&G Consulting
(508) 247-4936

Reply to chat, or unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 2: Day 4 - Outage insurance angle
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_switcher_001_2',
  'seq_pos_switcher_001',
  2,
  'Outage Insurance Angle',
  4,
  'days',
  'The real cost of POS outages (not what you think)',
  '<p>Hi {{first_name}},</p>
<p>Last February, Square went down for hours. Restaurants lost thousands in sales, had to handwrite tickets, and spent the next day reconciling.</p>
<p>The restaurants I migrated to Toast before that? They were serving dinner while their competitors were scrambling.</p>
<p>Switching is not about features. It is about risk mitigation.</p>
<p>If you have ever had that "what if this goes down during Friday rush" feeling, I can show you what a clean migration looks like - no menu retyping, no training chaos, no surprise downtime.</p>
<p>Want the 15-minute version?</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Last February, Square went down for hours. Restaurants lost thousands in sales, had to handwrite tickets, and spent the next day reconciling.

The restaurants I migrated to Toast before that? They were serving dinner while their competitors were scrambling.

Switching is not about features. It is about risk mitigation.

If you have ever had that "what if this goes down during Friday rush" feeling, I can show you what a clean migration looks like - no menu retyping, no training chaos, no surprise downtime.

Want the 15-minute version?

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 3: Day 8 - Speed differentiator
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_switcher_001_3',
  'seq_pos_switcher_001',
  3,
  'Speed Differentiator',
  8,
  'days',
  'Menu builds that take corporate 3 weeks - I deliver in 48 hours',
  '<p>Hi {{first_name}},</p>
<p>When Toast corporate handles a migration, you are in a queue. Menu builds take 2-3 weeks. Training is generic. Questions go to a call center.</p>
<p>I work differently:</p>
<ul>
<li>I migrate your menu data so you do not have to re-type it</li>
<li>I automate the configuration based on your actual workflow</li>
<li>I am a phone call away when something goes sideways</li>
</ul>
<p>Menu builds that take corporate 3 weeks? I deliver in 48 hours.</p>
<p>If speed and hands-on support matter to you, let us talk.</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

When Toast corporate handles a migration, you are in a queue. Menu builds take 2-3 weeks. Training is generic. Questions go to a call center.

I work differently:
- I migrate your menu data so you do not have to re-type it
- I automate the configuration based on your actual workflow
- I am a phone call away when something goes sideways

Menu builds that take corporate 3 weeks? I deliver in 48 hours.

If speed and hands-on support matter to you, let us talk.

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 4: Day 15 - Breakup email
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_switcher_001_4',
  'seq_pos_switcher_001',
  4,
  'Breakup Email',
  15,
  'days',
  'Closing your file?',
  '<p>Hi {{first_name}},</p>
<p>I have not heard back, so I am guessing one of three things:</p>
<ol>
<li>You are happy with your current POS</li>
<li>Switching is not a priority right now</li>
<li>You have been slammed (restaurants never slow down)</li>
</ol>
<p>If 1 or 2, no worries - I will stop reaching out.</p>
<p>If 3, just reply "later" and I will check back in a few months.</p>
<p>Either way, wishing {{company}} a great season.</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

I have not heard back, so I am guessing one of three things:

1. You are happy with your current POS
2. Switching is not a priority right now
3. You have been slammed (restaurants never slow down)

If 1 or 2, no worries - I will stop reaching out.

If 3, just reply "later" and I will check back in a few months.

Either way, wishing {{company}} a great season.

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- ============================================
-- SEGMENT C: TRANSITION SEQUENCE (4 emails, 14 days)
-- Target: Ownership changes, restaurant flips, new openings
-- Pain: Systems gap, handoff chaos, no-downtime pressure
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_transition_001',
  'Ownership Transition Outreach',
  'ownership-transition',
  'Outreach for restaurants undergoing ownership changes, flips, or new openings',
  'drip',
  'active',
  'America/New_York',
  '["segment-c", "transition", "new-owner", "flip", "opening"]'
);

-- Step 1: Day 0 - Systems gap intro
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_transition_001_1',
  'seq_transition_001',
  1,
  'Systems Gap Intro',
  0,
  'hours',
  'If you are taking over {{company}}, avoid the "systems gap"',
  '<p>Hi {{first_name}},</p>
<p>Restaurant transitions fail when the tech handoff is fuzzy: accounts, ordering channels, printers, staff training, vendor logins.</p>
<p>I run a Transition Package that maps ownership change into a clean, no-downtime checklist and executes the cutover.</p>
<p>Are you mid-deal or already signed?</p>
<p>Best,<br>Evan M. Ramirez<br>R&G Consulting<br>(508) 247-4936</p>
<p style="font-size: 12px; color: #666;">Reply to chat, or <a href="{{unsubscribe_url}}">unsubscribe</a></p>',
  'Hi {{first_name}},

Restaurant transitions fail when the tech handoff is fuzzy: accounts, ordering channels, printers, staff training, vendor logins.

I run a Transition Package that maps ownership change into a clean, no-downtime checklist and executes the cutover.

Are you mid-deal or already signed?

Best,
Evan M. Ramirez
R&G Consulting
(508) 247-4936

Reply to chat, or unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 2: Day 4 - Horror story prevention
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_transition_001_2',
  'seq_transition_001',
  2,
  'Horror Story Prevention',
  4,
  'days',
  'The $8,000 mistake new restaurant owners make',
  '<p>Hi {{first_name}},</p>
<p>Last month a new owner took over a restaurant and discovered:</p>
<ul>
<li>The previous owner still had admin access to Toast</li>
<li>Online ordering was depositing to the old bank account</li>
<li>Nobody knew the login to the router</li>
<li>The "training" was a binder nobody could find</li>
</ul>
<p>It took them 3 weeks and about $8,000 in lost revenue and emergency fixes to sort it out.</p>
<p>I prevent that. My Transition Package includes full system audit, credential transfer, and a checklist that catches the 47 things that get missed.</p>
<p>Worth a quick call before you take the keys?</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Last month a new owner took over a restaurant and discovered:
- The previous owner still had admin access to Toast
- Online ordering was depositing to the old bank account
- Nobody knew the login to the router
- The "training" was a binder nobody could find

It took them 3 weeks and about $8,000 in lost revenue and emergency fixes to sort it out.

I prevent that. My Transition Package includes full system audit, credential transfer, and a checklist that catches the 47 things that get missed.

Worth a quick call before you take the keys?

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 3: Day 8 - Zero downtime promise
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_transition_001_3',
  'seq_transition_001',
  3,
  'Zero Downtime Promise',
  8,
  'days',
  'How to change ownership without closing for a day',
  '<p>Hi {{first_name}},</p>
<p>Most restaurant flips involve at least one "closed for renovations" day just to sort out the technology. That is lost revenue you do not need to lose.</p>
<p>My Zero-Downtime Handoff Package:</p>
<ol>
<li>Pre-transition audit (what needs to change, what can stay)</li>
<li>Parallel account setup (new accounts ready before switchover)</li>
<li>Overnight cutover (flip happens between close and open)</li>
<li>Day-one support (I am there when doors open under new ownership)</li>
</ol>
<p>Restaurant flips are my specialty. Let me handle the handoff so you can focus on running the business.</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Most restaurant flips involve at least one "closed for renovations" day just to sort out the technology. That is lost revenue you do not need to lose.

My Zero-Downtime Handoff Package:
1. Pre-transition audit (what needs to change, what can stay)
2. Parallel account setup (new accounts ready before switchover)
3. Overnight cutover (flip happens between close and open)
4. Day-one support (I am there when doors open under new ownership)

Restaurant flips are my specialty. Let me handle the handoff so you can focus on running the business.

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- Step 4: Day 14 - Breakup email
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_transition_001_4',
  'seq_transition_001',
  4,
  'Breakup Email',
  14,
  'days',
  'Still planning the transition?',
  '<p>Hi {{first_name}},</p>
<p>I reached out about helping with your restaurant transition but have not heard back.</p>
<p>A few possibilities:</p>
<ol>
<li>The deal fell through (happens)</li>
<li>You have got the tech handoff covered</li>
<li>Timing is not right yet</li>
</ol>
<p>If the transition is still happening and you hit a tech snag, my number is below. Otherwise, I will leave you to it.</p>
<p>Good luck with {{company}}!</p>
<p>Best,<br>Evan<br>(508) 247-4936</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

I reached out about helping with your restaurant transition but have not heard back.

A few possibilities:
1. The deal fell through (happens)
2. You have got the tech handoff covered
3. Timing is not right yet

If the transition is still happening and you hit a tech snag, my number is below. Otherwise, I will leave you to it.

Good luck with {{company}}!

Best,
Evan
(508) 247-4936

Unsubscribe: {{unsubscribe_url}}',
  'Evan from R&G Consulting',
  'active'
);

-- ============================================
-- SEGMENT D: LOCAL NETWORK SEQUENCE (4 emails, 14 days)
-- Target: Cape Cod + South Shore + SE MA restaurants
-- Pain: Network drops, rat's nest cabling, Wi-Fi interference
-- ============================================
INSERT OR IGNORE INTO email_sequences (
  id, name, slug, description, sequence_type, status, timezone, tags_json
) VALUES (
  'seq_local_network_001',
  'Local Network Outreach',
  'local-network',
  'Outreach for Cape Cod, South Shore, and Southeastern MA restaurants with network/infrastructure needs',
  'drip',
  'active',
  'America/New_York',
  '["segment-d", "local", "network", "cabling", "cape-cod"]'
);

-- Step 1: Day 0 - Local intro
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_network_001_1',
  'seq_local_network_001',
  1,
  'Local Intro',
  0,
  'hours',
  'Quick local question - Wi-Fi or printers ever drop during rush?',
  '<p>Hi {{first_name}},</p>
<p>I am local on the Cape. I clean up restaurant networks and cabling so printers, KDS, and terminals do not fall apart when the building is slammed.</p>
<p>If you have got a "rat''s nest" closet or intermittent drops, I can do a Network Health Assessment and give you a clean remediation plan.</p>
<p>Want me to stop by for 20 minutes?</p>
<p>Best,<br>Evan M. Ramirez<br>Cape Cod Cable Contractors<br>(508) 247-4936</p>
<p style="font-size: 12px; color: #666;">Reply to chat, or <a href="{{unsubscribe_url}}">unsubscribe</a></p>',
  'Hi {{first_name}},

I am local on the Cape. I clean up restaurant networks and cabling so printers, KDS, and terminals do not fall apart when the building is slammed.

If you have got a "rat''s nest" closet or intermittent drops, I can do a Network Health Assessment and give you a clean remediation plan.

Want me to stop by for 20 minutes?

Best,
Evan M. Ramirez
Cape Cod Cable Contractors
(508) 247-4936

Reply to chat, or unsubscribe: {{unsubscribe_url}}',
  'Evan from Cape Cod Cable',
  'active'
);

-- Step 2: Day 4 - Kitchen environment expertise
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_network_001_2',
  'seq_local_network_001',
  2,
  'Kitchen Environment Expertise',
  4,
  'days',
  'Why your kitchen kills your Wi-Fi (and what to do about it)',
  '<p>Hi {{first_name}},</p>
<p>Most IT guys build networks for cubicles. I build for kitchens.</p>
<p>I know the microwave kills your Wi-Fi. I know grease degrades standard cabling. I know you cannot shut down for "maintenance windows."</p>
<p>That is why I use:</p>
<ul>
<li>Plenum-rated cabling that handles kitchen heat and grease</li>
<li>Commercial-grade access points positioned away from interference</li>
<li>Managed switches that prioritize POS traffic over guest Wi-Fi</li>
</ul>
<p>If your printers randomly stop working during Friday rush, the problem is almost always environmental. I can fix it.</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

Most IT guys build networks for cubicles. I build for kitchens.

I know the microwave kills your Wi-Fi. I know grease degrades standard cabling. I know you cannot shut down for "maintenance windows."

That is why I use:
- Plenum-rated cabling that handles kitchen heat and grease
- Commercial-grade access points positioned away from interference
- Managed switches that prioritize POS traffic over guest Wi-Fi

If your printers randomly stop working during Friday rush, the problem is almost always environmental. I can fix it.

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from Cape Cod Cable',
  'active'
);

-- Step 3: Day 8 - Chapin's story
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_network_001_3',
  'seq_local_network_001',
  3,
  'Local Case Study',
  8,
  'days',
  'How a Cape restaurant stopped losing tickets during peak hours',
  '<p>Hi {{first_name}},</p>
<p>A restaurant on the Cape was losing kitchen tickets every Friday and Saturday night. The KDS would freeze, printers would drop, and the expo line would back up.</p>
<p>They thought it was Toast. Toast said it was their network. Nobody fixed it.</p>
<p>I found the problem in 20 minutes: an unmanaged switch daisy-chained behind the bar, a consumer-grade router from 2018, and Cat5 cable running through the ceiling next to a commercial microwave.</p>
<p>New switch, new cabling, repositioned access point. Total fix time: 4 hours. No more dropped tickets.</p>
<p>If that sounds familiar, I can take a look.</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

A restaurant on the Cape was losing kitchen tickets every Friday and Saturday night. The KDS would freeze, printers would drop, and the expo line would back up.

They thought it was Toast. Toast said it was their network. Nobody fixed it.

I found the problem in 20 minutes: an unmanaged switch daisy-chained behind the bar, a consumer-grade router from 2018, and Cat5 cable running through the ceiling next to a commercial microwave.

New switch, new cabling, repositioned access point. Total fix time: 4 hours. No more dropped tickets.

If that sounds familiar, I can take a look.

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from Cape Cod Cable',
  'active'
);

-- Step 4: Day 14 - Breakup email
INSERT OR IGNORE INTO sequence_steps (
  id, sequence_id, step_number, step_name, delay_value, delay_unit,
  subject_a, body_html_a, body_text_a, from_name_a, status
) VALUES (
  'step_network_001_4',
  'seq_local_network_001',
  4,
  'Breakup Email',
  14,
  'days',
  'Network running smoothly?',
  '<p>Hi {{first_name}},</p>
<p>I reached out about network reliability but have not heard back.</p>
<p>Either your network is rock solid (great!) or this is not a priority right now (totally understand).</p>
<p>If things ever start dropping during service and you want a quick assessment, my number is (508) 247-4936. I am local and can usually stop by same week.</p>
<p>Wishing you a smooth season!</p>
<p>Best,<br>Evan</p>
<p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hi {{first_name}},

I reached out about network reliability but have not heard back.

Either your network is rock solid (great!) or this is not a priority right now (totally understand).

If things ever start dropping during service and you want a quick assessment, my number is (508) 247-4936. I am local and can usually stop by same week.

Wishing you a smooth season!

Best,
Evan

Unsubscribe: {{unsubscribe_url}}',
  'Evan from Cape Cod Cable',
  'active'
);

-- ============================================
-- UPDATE SEQUENCE STEP COUNTS
-- ============================================
-- Note: These sequences follow SPEAR principles:
-- Short, Personal, Expecting A Reply
-- Plain text emphasis, single CTA, breakup email for highest conversion
