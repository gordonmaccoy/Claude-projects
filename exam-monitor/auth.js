const { createClient } = require('@supabase/supabase-js');
function authConfig(env = process.env) {
  return { url: env.SUPABASE_URL || '', key: env.SUPABASE_PUBLISHABLE_KEY || '', origin: env.APP_ORIGIN || '' };
}
function createVerifier(config) {
  if (!config.url || !config.key) return async () => null;
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  return async token => {
    if (typeof token !== 'string' || token.length > 12000) return null;
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at) return null;
    return { id: data.user.id, email: data.user.email };
  };
}
module.exports = { authConfig, createVerifier };
