-- Email content updates for sequence steps
-- Run with: npx wrangler d1 execute rg-consulting-forms --remote --file=scripts/email_content.sql

-- Step 1: POS Switcher - Switch Anxiety Intro
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>Quick question - how long does it take your team to ring up a complicated order?</p><p>I ask because I''ve worked with dozens of restaurants switching from Clover and Square to Toast, and the #1 thing owners tell me after the switch is: "I didn''t realize how much time we were losing."</p><p>The difference isn''t just the hardware. It''s having someone who actually understands restaurant operations configure your system - not a generic sales rep reading from a script.</p><p>I''m Evan with R&amp;G Consulting. I specialize in Toast implementations for restaurants like {{company}}. If you''ve ever thought about switching (or just want to know what you''re missing), I''m happy to do a quick 15-minute assessment - no pressure, no sales pitch.</p><p><a href="https://cal.com/r-g-consulting/toast-assessment">Book a free assessment</a> or just reply to this email.</p><p>- Evan</p>',
body_text_a = 'Hi {{first_name}},

Quick question - how long does it take your team to ring up a complicated order?

I ask because I''ve worked with dozens of restaurants switching from Clover and Square to Toast, and the #1 thing owners tell me after the switch is: "I didn''t realize how much time we were losing."

The difference isn''t just the hardware. It''s having someone who actually understands restaurant operations configure your system - not a generic sales rep reading from a script.

I''m Evan with R&G Consulting. I specialize in Toast implementations for restaurants like {{company}}. If you''ve ever thought about switching (or just want to know what you''re missing), I''m happy to do a quick 15-minute assessment - no pressure, no sales pitch.

Book here: https://cal.com/r-g-consulting/toast-assessment

- Evan'
WHERE id = 'step_switcher_001_1';

-- Step 2: POS Switcher - Outage Insurance Angle
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>Last month I got a call from a restaurant owner at 7pm on a Friday. His POS went down. Support told him "restart the router" - didn''t work. Then "we''ll send someone Monday."</p><p>Monday. During a weekend rush.</p><p>He lost about $3,400 in sales running orders on paper. But here''s what most people miss: he also lost 2 servers who quit that night (the stress wasn''t worth it), and 47 bad reviews from frustrated customers.</p><p>The real cost of that outage? Closer to $15,000.</p><p>This is why I set up every restaurant I work with for what I call "outage insurance" - a configuration that keeps you running even when things go wrong. It''s not complicated, but it requires someone who knows what they''re doing.</p><p>If you want to know how vulnerable your current setup is, I can tell you in 15 minutes.</p><p><a href="https://cal.com/r-g-consulting/toast-assessment">Schedule your assessment</a></p><p>- Evan</p>',
body_text_a = 'Hi {{first_name}},

Last month I got a call from a restaurant owner at 7pm on a Friday. His POS went down. Support told him "restart the router" - didn''t work. Then "we''ll send someone Monday."

Monday. During a weekend rush.

He lost about $3,400 in sales running orders on paper. But here''s what most people miss: he also lost 2 servers who quit that night, and 47 bad reviews from frustrated customers.

The real cost of that outage? Closer to $15,000.

This is why I set up every restaurant I work with for what I call "outage insurance" - a configuration that keeps you running even when things go wrong.

If you want to know how vulnerable your current setup is, I can tell you in 15 minutes.

Schedule here: https://cal.com/r-g-consulting/toast-assessment

- Evan'
WHERE id = 'step_switcher_001_2';

-- Step 3: POS Switcher - Speed Differentiator
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>True story: A restaurant owner called Toast corporate to update his menu. 247 items, nothing crazy. They told him 3 weeks.</p><p>He called me instead. I had it done in 2 days - with better modifiers, proper coursing, and a layout his servers actually understood.</p><p>The difference? I''m not juggling 200 accounts. When you work with me, you''re working with someone who will answer when you call.</p><p>Here''s what I typically do for restaurants considering a switch:</p><ul><li>Full menu analysis and optimization</li><li>Staff training (I train your people, not just hand you a manual)</li><li>30 days of direct support - text me, call me, whatever you need</li></ul><p>And if you''re worried about the switch itself? I''ve done this enough times that I can usually get you running with zero downtime. Your Friday night service won''t skip a beat.</p><p><a href="https://cal.com/r-g-consulting/toast-assessment">Let''s talk about your timeline</a></p><p>- Evan</p>',
body_text_a = 'Hi {{first_name}},

True story: A restaurant owner called Toast corporate to update his menu. 247 items, nothing crazy. They told him 3 weeks.

He called me instead. I had it done in 2 days - with better modifiers, proper coursing, and a layout his servers actually understood.

The difference? I''m not juggling 200 accounts. When you work with me, you''re working with someone who will answer when you call.

Here''s what I typically do for restaurants considering a switch:
- Full menu analysis and optimization
- Staff training (I train your people, not just hand you a manual)
- 30 days of direct support - text me, call me, whatever you need

And if you''re worried about the switch itself? I''ve done this enough times that I can usually get you running with zero downtime.

Let''s talk: https://cal.com/r-g-consulting/toast-assessment

- Evan'
WHERE id = 'step_switcher_001_3';

-- Step 4: POS Switcher - Breakup Email
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>I''ve reached out a few times about your POS setup at {{company}} - no response, so I''m guessing the timing isn''t right.</p><p>No problem. I''m going to close your file for now.</p><p>But if things change - you have a rough night with your current system, you''re ready to explore options, or you just want a second opinion - my door''s open.</p><p>Reply to this email anytime. I keep all my conversations.</p><p>Good luck with everything,</p><p>Evan</p><p>P.S. If you know another restaurant owner who''s struggling with their POS, I''d appreciate the referral. I pay $250 for any referral that turns into a project.</p>',
body_text_a = 'Hi {{first_name}},

I''ve reached out a few times about your POS setup at {{company}} - no response, so I''m guessing the timing isn''t right.

No problem. I''m going to close your file for now.

But if things change - you have a rough night with your current system, you''re ready to explore options, or you just want a second opinion - my door''s open.

Reply to this email anytime. I keep all my conversations.

Good luck with everything,
Evan

P.S. If you know another restaurant owner who''s struggling with their POS, I''d appreciate the referral. I pay $250 for any referral that turns into a project.'
WHERE id = 'step_switcher_001_4';

-- Step 5: Transition - Systems Gap Intro
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>I noticed some activity around {{company}} that suggests an ownership change might be happening. If that''s you - congratulations, and also: watch out for the systems gap.</p><p>The systems gap is that period between when the old owner leaves and when you actually understand how everything works. The POS passwords, the vendor accounts, the employee schedules buried in someone''s phone.</p><p>I''ve helped 15+ restaurant transitions over the past two years, and the ones that go smoothly have one thing in common: they brought in someone to document and transfer everything BEFORE the old owner checked out.</p><p>If you''re in the middle of this (or about to be), I''d be happy to walk you through what a clean handoff looks like. No charge for the conversation.</p><p><a href="https://cal.com/r-g-consulting/transition-planning">Book a transition planning call</a></p><p>- Evan<br>R&amp;G Consulting</p>',
body_text_a = 'Hi {{first_name}},

I noticed some activity around {{company}} that suggests an ownership change might be happening. If that''s you - congratulations, and also: watch out for the systems gap.

The systems gap is that period between when the old owner leaves and when you actually understand how everything works. The POS passwords, the vendor accounts, the employee schedules.

I''ve helped 15+ restaurant transitions, and the ones that go smoothly have one thing in common: they brought in someone to document everything BEFORE the old owner checked out.

If you''re in the middle of this, I''d be happy to walk you through what a clean handoff looks like. No charge for the conversation.

Book here: https://cal.com/r-g-consulting/transition-planning

- Evan
R&G Consulting'
WHERE id = 'step_transition_001_1';

-- Step 6: Transition - Horror Story Prevention
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>Quick story about a new owner I worked with last year.</p><p>He bought a restaurant, thought he was getting everything - equipment, recipes, staff, the works. What he didn''t know: the POS system was leased (not owned), the menu was never properly entered (staff had it memorized), and 3 key employees were about to quit because they weren''t told about the sale.</p><p>Total cost to fix all that after closing? About $8,000 and 6 weeks of chaos.</p><p>Here''s the thing: all of that was preventable. A proper technology audit before closing takes maybe 4 hours and costs a fraction of fixing problems after.</p><p>I do these audits for restaurant acquisitions. I look at:</p><ul><li>POS ownership and configuration status</li><li>Vendor contracts and account access</li><li>Staff system knowledge (who knows what)</li><li>Network and hardware condition</li></ul><p>If you''re in due diligence or just closed, this is worth 30 minutes of your time.</p><p><a href="https://cal.com/r-g-consulting/transition-planning">Schedule a quick call</a></p><p>- Evan</p>',
body_text_a = 'Hi {{first_name}},

Quick story about a new owner I worked with last year.

He bought a restaurant, thought he was getting everything. What he didn''t know: the POS was leased, the menu was never properly entered, and 3 key employees were about to quit.

Total cost to fix after closing? About $8,000 and 6 weeks of chaos.

Here''s the thing: all of that was preventable. A proper technology audit before closing takes 4 hours.

I do these audits for restaurant acquisitions. I look at:
- POS ownership and configuration
- Vendor contracts and account access
- Staff system knowledge
- Network and hardware condition

If you''re in due diligence or just closed, this is worth 30 minutes.

Schedule here: https://cal.com/r-g-consulting/transition-planning

- Evan'
WHERE id = 'step_transition_001_2';

-- Step 7: Transition - Zero Downtime Promise
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>Most restaurant ownership transfers I see involve at least one "dark day" - a day where the restaurant closes to switch over systems, train on new processes, or just figure things out.</p><p>That doesn''t have to happen.</p><p>The last 8 transitions I''ve managed had zero downtime. Here''s the basic approach:</p><ol><li><strong>Parallel systems</strong> - New accounts set up while old ones still running</li><li><strong>Staff briefings</strong> - Individual 15-minute sessions, not a group meeting that kills a shift</li><li><strong>Staged cutover</strong> - Switch one station at a time during slow hours</li><li><strong>On-site support</strong> - I''m there for the first service under new ownership</li></ol><p>It takes planning, but it''s absolutely doable. And it means you start generating revenue from day one instead of losing a Friday night to "technical difficulties."</p><p>If you''re planning a transition and want to do it right, let''s map it out.</p><p><a href="https://cal.com/r-g-consulting/transition-planning">Book your planning session</a></p><p>- Evan</p>',
body_text_a = 'Hi {{first_name}},

Most restaurant ownership transfers involve at least one "dark day" - a day where the restaurant closes to switch over systems.

That doesn''t have to happen.

The last 8 transitions I''ve managed had zero downtime. Here''s the approach:

1. Parallel systems - New accounts set up while old ones running
2. Staff briefings - Individual 15-minute sessions, not group meetings
3. Staged cutover - Switch one station at a time during slow hours
4. On-site support - I''m there for the first service under new ownership

It means you start generating revenue from day one instead of losing a Friday night.

Let''s map it out: https://cal.com/r-g-consulting/transition-planning

- Evan'
WHERE id = 'step_transition_001_3';

-- Step 8: Transition - Breakup Email
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>I reached out a few times about helping with the ownership transition at {{company}}. Haven''t heard back, so I''m guessing either:</p><ol><li>The deal fell through</li><li>You''ve got it handled</li><li>Timing''s just not right</li></ol><p>All good. I''m going to stop reaching out, but my offer stands: if you need help with the technology side of a restaurant acquisition, I''m probably one of the few people who actually specializes in this.</p><p>Save this email. You might need it later.</p><p>Good luck with everything,</p><p>Evan</p><p>P.S. Know someone else buying or selling a restaurant? I pay $500 for transition project referrals.</p>',
body_text_a = 'Hi {{first_name}},

I reached out a few times about helping with the ownership transition at {{company}}. Haven''t heard back, so I''m guessing either:

1. The deal fell through
2. You''ve got it handled
3. Timing''s just not right

All good. I''m going to stop reaching out, but my offer stands: if you need help with the technology side of a restaurant acquisition, I''m probably one of the few people who actually specializes in this.

Save this email. You might need it later.

Good luck with everything,
Evan

P.S. Know someone else buying or selling a restaurant? I pay $500 for transition project referrals.'
WHERE id = 'step_transition_001_4';

-- Step 9: Local Network - Local Intro
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>Quick question for you - does your Wi-Fi or kitchen printer ever drop during the dinner rush?</p><p>I ask because I''m Evan from Cape Cod Cable Contractors, and I''ve been fixing exactly this problem for restaurants around the Cape for the past few years. The pattern is almost always the same:</p><ul><li>Consumer-grade router that can''t handle 30+ devices</li><li>Kitchen printer on the same network as guest Wi-Fi</li><li>Dead spots near the host stand or patio</li></ul><p>If any of that sounds familiar, I can usually fix it in a day. I''m local (Barnstable), I know restaurant environments, and I''ve got references from places you''d recognize.</p><p>Want me to swing by for a quick look? No charge to assess what''s going on.</p><p><a href="https://cal.com/r-g-consulting/network-assessment">Schedule a site visit</a> or just reply with a good time.</p><p>- Evan<br>Cape Cod Cable Contractors<br>774-408-0083</p>',
body_text_a = 'Hi {{first_name}},

Quick question - does your Wi-Fi or kitchen printer ever drop during the dinner rush?

I''m Evan from Cape Cod Cable Contractors. I''ve been fixing exactly this problem for restaurants around the Cape. The pattern is almost always:

- Consumer-grade router that can''t handle 30+ devices
- Kitchen printer on the same network as guest Wi-Fi
- Dead spots near the host stand or patio

If any of that sounds familiar, I can usually fix it in a day. I''m local (Barnstable) and I''ve got references from places you''d recognize.

Want me to swing by for a quick look? No charge to assess.

Schedule here: https://cal.com/r-g-consulting/network-assessment

- Evan
Cape Cod Cable Contractors
774-408-0083'
WHERE id = 'step_network_001_1';

-- Step 10: Local Network - Kitchen Environment Expertise
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>Fun fact: the average restaurant kitchen is basically a Wi-Fi graveyard.</p><p>Stainless steel everywhere (reflects signals), commercial refrigerators (blocks signals), heat and steam (degrades equipment), and usually a printer sitting right in the middle of it all wondering why it can''t stay connected.</p><p>I''ve pulled the network cable in probably 40 Cape restaurants at this point, and here''s what actually works:</p><ul><li><strong>Hardwired kitchen devices</strong> - Printers on ethernet, not Wi-Fi</li><li><strong>Dedicated access points</strong> - One for kitchen, one for FOH, one for guests</li><li><strong>Commercial-grade equipment</strong> - Consumer routers die in 6 months in a kitchen</li></ul><p>The difference between a restaurant that has network problems and one that doesn''t usually comes down to about $800 in equipment and half a day of installation.</p><p>If you''re dealing with drops, slowdowns, or "it only happens when we''re busy" issues, I can tell you exactly what''s wrong and what it costs to fix.</p><p><a href="https://cal.com/r-g-consulting/network-assessment">Book a free site assessment</a></p><p>- Evan<br>774-408-0083</p>',
body_text_a = 'Hi {{first_name}},

Fun fact: the average restaurant kitchen is basically a Wi-Fi graveyard.

Stainless steel reflects signals, refrigerators block them, heat degrades equipment. And there''s usually a printer in the middle wondering why it can''t stay connected.

Here''s what actually works:

- Hardwired kitchen devices - Printers on ethernet, not Wi-Fi
- Dedicated access points - One for kitchen, one for FOH, one for guests
- Commercial-grade equipment - Consumer routers die in 6 months in a kitchen

The difference usually comes down to about $800 in equipment and half a day of installation.

If you''re dealing with drops or "it only happens when we''re busy" issues, I can tell you what''s wrong and what it costs to fix.

Book here: https://cal.com/r-g-consulting/network-assessment

- Evan
774-408-0083'
WHERE id = 'step_network_001_2';

-- Step 11: Local Network - Local Case Study
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>Quick story from a restaurant in Hyannis I worked with last summer.</p><p>They were losing 10-15 kitchen tickets every Friday and Saturday night. Orders would print to the wrong station, or not print at all. The owner thought it was a Toast problem. Toast thought it was a printer problem. The printer company thought it was a network problem.</p><p>It was a network problem.</p><p>Specifically: one $80 router trying to handle 47 devices (POS terminals, kitchen displays, tablets, staff phones, and 200+ guest devices hitting the "Free WiFi" network).</p><p>Here''s what I installed:</p><ul><li>Commercial-grade router with proper traffic management</li><li>Separate VLAN for POS traffic (can''t be affected by guest usage)</li><li>Hardwired connections to all 4 kitchen printers</li><li>2 additional access points for coverage</li></ul><p>Total cost: about $2,400 including labor. Time to pay back: roughly 3 weekends of not losing orders.</p><p>They haven''t lost a ticket since July.</p><p>If this sounds like your situation, let''s talk.</p><p><a href="https://cal.com/r-g-consulting/network-assessment">Schedule your assessment</a></p><p>- Evan</p>',
body_text_a = 'Hi {{first_name}},

Quick story from a restaurant in Hyannis I worked with last summer.

They were losing 10-15 kitchen tickets every Friday and Saturday night. Toast thought it was a printer problem. The printer company thought it was a network problem.

It was a network problem.

One $80 router trying to handle 47 devices including 200+ guests on "Free WiFi."

Here''s what I installed:
- Commercial-grade router with traffic management
- Separate VLAN for POS traffic
- Hardwired connections to all 4 kitchen printers
- 2 additional access points for coverage

Total cost: about $2,400 including labor. They haven''t lost a ticket since July.

If this sounds like your situation, let''s talk.

Schedule here: https://cal.com/r-g-consulting/network-assessment

- Evan'
WHERE id = 'step_network_001_3';

-- Step 12: Local Network - Breakup Email
UPDATE sequence_steps SET
body_html_a = '<p>Hi {{first_name}},</p><p>I''ve reached out a few times about your network setup at {{company}}. No response, so I''m guessing either everything''s running great or the timing isn''t right.</p><p>Either way, no worries. I''m local and I''m not going anywhere - if you ever have a network emergency (printer down during service, Wi-Fi completely out, that kind of thing), save my number:</p><p><strong>774-408-0083</strong></p><p>I can usually be on-site within an hour for Cape Cod locations, and I don''t charge for the first 30 minutes of emergency diagnosis.</p><p>Good luck this season,</p><p>Evan<br>Cape Cod Cable Contractors</p><p>P.S. If you know another restaurant owner dealing with network headaches, I pay $100 for referrals that turn into projects.</p>',
body_text_a = 'Hi {{first_name}},

I''ve reached out a few times about your network setup at {{company}}. No response, so I''m guessing either everything''s running great or the timing isn''t right.

Either way, no worries. I''m local - if you ever have a network emergency, save my number:

774-408-0083

I can usually be on-site within an hour for Cape Cod locations, and I don''t charge for the first 30 minutes of emergency diagnosis.

Good luck this season,
Evan
Cape Cod Cable Contractors

P.S. If you know another restaurant owner dealing with network headaches, I pay $100 for referrals.'
WHERE id = 'step_network_001_4';
