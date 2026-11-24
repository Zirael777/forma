// COPY TO config.js. The browser key here is PUBLIC; NEVER put secret/service_role keys here.
window.FORMA_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
  functionName: 'submit-order',
  // Cloudflare Turnstile public site key; required for live photo submissions.
  turnstileSiteKey: 'YOUR_TURNSTILE_SITE_KEY'
};
