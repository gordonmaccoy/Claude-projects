const { createClient } = require('@supabase/supabase-js');
function authConfig(env = process.env) {
  const key = env.SUPABASE_PUBLISHABLE_KEY || '';
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role; } catch {}
  if (key.startsWith('sb_secret_') || role === 'service_role') throw new Error('Use the Supabase publishable key, never a secret/service_role key');
  return { url: env.SUPABASE_URL || '', key,
    origin: env.APP_ORIGIN || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : '') };
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
