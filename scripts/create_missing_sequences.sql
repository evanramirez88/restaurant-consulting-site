-- Create Missing Email Sequences
-- Welcome sequence for new subscribers
-- Payment failed sequence for recovery

-- Welcome Sequence
INSERT OR IGNORE INTO email_sequences (id, name, description, sequence_type, status, created_at, updated_at)
VALUES (
  'seq_welcome_001',
  'New Subscriber Welcome',
  'Welcome new customers after subscription signup. Introduces them to services and schedules first check-in.',
  'transactional',
  'active',
  unixepoch(),
  unixepoch()
);

-- Welcome sequence steps
INSERT OR IGNORE INTO sequence_steps (id, sequence_id, step_number, step_name, delay_value, delay_unit, subject_a, body_html_a, status, created_at, updated_at)
VALUES
  (
    'step_welcome_001_1',
    'seq_welcome_001',
    1,
    'Welcome Email',
    0,
    'minutes',
    'Welcome to R&G Consulting! Your Support Plan is Active',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #f59e0b;">Welcome to R&G Consulting!</h2>
<p>Hi {{first_name}},</p>
<p>Thank you for choosing R&G Consulting for your restaurant technology support. Your subscription is now active and you have access to our full support team.</p>
<h3>What happens next?</h3>
<ul>
<li><strong>Priority Support:</strong> Contact us anytime at support@ccrestaurantconsulting.com</li>
<li><strong>Response Time:</strong> We typically respond within 2-4 business hours</li>
<li><strong>Emergency Line:</strong> 774-408-0083 for urgent issues</li>
</ul>
<p>We recommend scheduling an initial consultation call to review your current setup and identify any optimization opportunities.</p>
<p><a href="https://cal.com/r-g-consulting/consultation" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Schedule Your Welcome Call</a></p>
<p>Best regards,<br>Evan Ramirez<br>R&G Consulting</p>
</div>',
    'active',
    unixepoch(),
    unixepoch()
  ),
  (
    'step_welcome_001_2',
    'seq_welcome_001',
    2,
    'Getting Started Tips',
    1440,
    'minutes',
    'Getting Started: Tips for Your Toast POS',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #f59e0b;">Getting the Most from Your Support Plan</h2>
<p>Hi {{first_name}},</p>
<p>Now that you are set up with R&G Consulting, here are some quick wins to optimize your restaurant technology:</p>
<h3>Quick Wins This Week</h3>
<ol>
<li><strong>Review Your Menu Structure:</strong> Ensure modifier groups are efficient</li>
<li><strong>Check Report Settings:</strong> Set up daily email reports</li>
<li><strong>Verify Printer Routing:</strong> Confirm tickets route to correct stations</li>
</ol>
<h3>Common Questions We Can Help With</h3>
<ul>
<li>Menu updates and seasonal changes</li>
<li>Employee management and permissions</li>
<li>Report customization and analysis</li>
<li>Hardware troubleshooting</li>
</ul>
<p>Just reply to this email with any questions - we are here to help!</p>
<p>Best,<br>The R&G Team</p>
</div>',
    'active',
    unixepoch(),
    unixepoch()
  ),
  (
    'step_welcome_001_3',
    'seq_welcome_001',
    3,
    'Check-in Reminder',
    4320,
    'minutes',
    'Have You Scheduled Your Check-in Call?',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #f59e0b;">Let Us Optimize Your Setup</h2>
<p>Hi {{first_name}},</p>
<p>Just checking in to see if you have had a chance to schedule your welcome consultation.</p>
<p>During this 30-minute call, we will:</p>
<ul>
<li>Review your current Toast configuration</li>
<li>Identify quick optimization opportunities</li>
<li>Answer any questions about your support plan</li>
<li>Discuss your goals for the next quarter</li>
</ul>
<p><a href="https://cal.com/r-g-consulting/consultation" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Book Your Free Consultation</a></p>
<p>Already have everything running smoothly? Great! Just reply and let us know - we love hearing success stories.</p>
<p>Best,<br>Evan</p>
</div>',
    'active',
    unixepoch(),
    unixepoch()
  );

-- Payment Failed Sequence
INSERT OR IGNORE INTO email_sequences (id, name, description, sequence_type, status, created_at, updated_at)
VALUES (
  'seq_payment_failed_001',
  'Payment Recovery',
  'Re-engage customers with failed payments. Provides easy way to update payment method.',
  'behavior',
  'active',
  unixepoch(),
  unixepoch()
);

-- Payment failed sequence steps
INSERT OR IGNORE INTO sequence_steps (id, sequence_id, step_number, step_name, delay_value, delay_unit, subject_a, body_html_a, status, created_at, updated_at)
VALUES
  (
    'step_payfail_001_1',
    'seq_payment_failed_001',
    1,
    'Payment Issue Notice',
    60,
    'minutes',
    'Action Required: Payment Issue with Your R&G Subscription',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #ef4444;">Payment Issue Detected</h2>
<p>Hi {{first_name}},</p>
<p>We attempted to process your subscription payment but it was unsuccessful. This can happen for several reasons:</p>
<ul>
<li>Card expired or details changed</li>
<li>Insufficient funds</li>
<li>Bank security block on the transaction</li>
</ul>
<p>To keep your support plan active, please update your payment method:</p>
<p><a href="https://ccrestaurantconsulting.com/#/portal/{{client_slug}}/billing" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a></p>
<p>If you have any questions or need assistance, just reply to this email or call us at 774-408-0083.</p>
<p>Best regards,<br>R&G Consulting Billing Team</p>
</div>',
    'active',
    unixepoch(),
    unixepoch()
  ),
  (
    'step_payfail_001_2',
    'seq_payment_failed_001',
    2,
    'Final Notice',
    4320,
    'minutes',
    'Final Notice: Your Support Plan Will Be Paused',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #ef4444;">Important: Service Interruption Warning</h2>
<p>Hi {{first_name}},</p>
<p>This is a final reminder that your payment method needs to be updated. Without a successful payment, your support plan will be paused in 48 hours.</p>
<p><strong>What this means:</strong></p>
<ul>
<li>Priority support will no longer be available</li>
<li>Response times will increase to standard rates</li>
<li>Emergency line access will be suspended</li>
</ul>
<p>We do not want to see you lose your support coverage. Updating your payment takes less than 2 minutes:</p>
<p><a href="https://ccrestaurantconsulting.com/#/portal/{{client_slug}}/billing" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Now</a></p>
<p>Need help? Call us directly at 774-408-0083 - we are here to assist.</p>
<p>Best regards,<br>Evan Ramirez<br>R&G Consulting</p>
</div>',
    'active',
    unixepoch(),
    unixepoch()
  );
