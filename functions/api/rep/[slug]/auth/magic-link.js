// Rep Magic Link API - Send magic link for rep authentication
import jwt from '@tsndr/cloudflare-worker-jwt';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const { slug } = context.params;
    const body = await context.request.json();
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find rep by slug and email
    const rep = await db.prepare(`
      SELECT id, email, name, slug
      FROM reps
      WHERE slug = ? AND LOWER(email) = LOWER(?) AND portal_enabled = 1
    `).bind(slug, email).first();

    if (!rep) {
      // Don't reveal whether rep exists or email matches
      // But still return success to prevent email enumeration
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists, a login link has been sent.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate magic link token
    const jwtSecret = context.env.REP_JWT_SECRET || context.env.JWT_SECRET || context.env.ADMIN_PASSWORD_HASH;
    if (!jwtSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = await jwt.sign({
      repId: rep.id,
      email: rep.email,
      slug: rep.slug,
      type: 'magic-link',
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    }, jwtSecret);

    // Build magic link URL
    const origin = new URL(context.request.url).origin;
    const magicLink = `${origin}/#/rep/${slug}/login?token=${token}`;

    // Log the magic link for development (remove in production)
    console.log('Magic link for', rep.email, ':', magicLink);

    // TODO: Send email with magic link using email service
    // For now, we'll just log it and return success
    // In production, integrate with Resend or another email service:
    //
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     from: 'R&G Consulting <noreply@ccrestaurantconsulting.com>',
    //     to: rep.email,
    //     subject: 'Your Rep Portal Login Link',
    //     html: `
    //       <h2>Hi ${rep.name},</h2>
    //       <p>Click the link below to sign in to your Rep Portal:</p>
    //       <p><a href="${magicLink}">Sign In to Rep Portal</a></p>
    //       <p>This link expires in 15 minutes.</p>
    //       <p>If you didn't request this, you can ignore this email.</p>
    //     `
    //   })
    // });

    return new Response(JSON.stringify({
      success: true,
      message: 'Magic link sent to your email'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Magic link error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
