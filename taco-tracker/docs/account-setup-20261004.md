# Enable Google and Kakao accounts

Prepared 4 October 2026. The code provides the login flow, but provider settings must be enabled in your own Supabase, Google and Kakao dashboards. This guide does not mean those settings or the profile SQL have already been applied.

## 1. Set the Supabase website address

1. Open <https://supabase.com/dashboard> and select the **Taco Map** project.
2. Go to **Authentication > URL Configuration**.
3. Set **Site URL** to `https://taco-tracker-alpha.vercel.app`.
4. Add `https://taco-tracker-alpha.vercel.app/auth/callback` to **Redirect URLs**.
5. Save.

The app adds language and return-page query parameters to this callback. English returns to `/en`; Korean is the default language and returns to `/`, with Korean login at `/login`. `/ko` may redirect to the default Korean path. The app's callback must allow only a safe path within Taco Map as its `next` destination. Production uses the production origin, not a domain supplied by the visitor. Do not add a broad `https://*.vercel.app/**` rule. For a controlled preview, register its exact callback with the query parameters it uses, or a query wildcard restricted to that exact host and `/auth/callback` path. A callback on a different origin is matched as a full URL, so adding only its base callback may not cover the language/return-page query.

Typical callback URLs are `https://taco-tracker-alpha.vercel.app/auth/callback?locale=en&next=%2Fen` and `https://taco-tracker-alpha.vercel.app/auth/callback?locale=ko&next=%2F`. `%2F` is the encoded slash in the return path. They remain on the same production website; do not paste these language query parameters into Google's or Kakao's provider callback field.

## 2. Copy the Supabase provider callback

1. Open **Authentication > Sign In / Providers**. Some dashboard versions label this simply **Providers**.
2. Expand **Google** or **Kakao**.
3. Copy the **Callback URL (for OAuth)** shown there.

It will usually look like `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. `<PROJECT_REF>` is a placeholder, so do not paste that example literally. Copy the actual value displayed in your project.

| Address | Where it belongs |
| --- | --- |
| `https://<PROJECT_REF>.supabase.co/auth/v1/callback` | Google Authorized redirect URIs and Kakao Login Redirect URI |
| `https://taco-tracker-alpha.vercel.app/auth/callback` | Supabase Redirect URLs; the app exchanges the returned code here |
| `https://taco-tracker-alpha.vercel.app` | Supabase Site URL and Google Authorized JavaScript origins |

The Google/Kakao callback is the **Supabase address**, not the Vercel app address. Mixing the two is a common cause of failed login.

## 3. Enable Google

1. Open <https://console.cloud.google.com/> and create or select a project for Taco Map.
2. Open **Google Auth Platform**. Complete **Branding** and set the user **Audience**. For initial testing, add your account as a test user when testing restrictions apply.
3. In **Data Access**, use `openid`, email and basic profile scopes only.
4. In **Clients**, create an **OAuth client ID**, type **Web application**.
5. Add `https://taco-tracker-alpha.vercel.app` as an **Authorized JavaScript origin**.
6. Add the copied Supabase callback as an **Authorized redirect URI**.
7. Create the client. Copy its **Client ID** and **Client Secret** directly into Supabase's **Google provider** fields.
8. Enable Google and save.

Test with your own account first. When opening to other users, review Google's Audience/publishing and any branding verification requirements shown in that project.

## 4. Enable Kakao

1. Open <https://developers.kakao.com/> and select the Taco Map app already used for maps, or create a separate login app if you want separate management.
2. Open **Kakao Login > Enable**, also shown as **Product Settings > Kakao Login > General** in some dashboards. Turn login **ON**.
3. Open **App > Platform Key > REST API key**.
4. Add the copied Supabase callback under **Kakao Login Redirect URI** and save.
5. Copy this **REST API key** and its **Kakao Login Client Secret**. Keep the secret enabled.
6. Under **Kakao Login > Consent Items**, configure nickname and profile image for sign-in profile information. Do not request phone, contacts or messaging access.
7. For this first phase, omit `account_email`. In Supabase's **Kakao provider**, enable **Allow users without an email**.
8. Enter the **REST API key** as **Client ID**, enter the **Client Secret**, enable Kakao and save.

The **JavaScript key** already used for Kakao Maps is a different key. Leave the working map JavaScript domains in place. Google/Kakao client secrets belong in the Supabase provider dashboard, not in a `NEXT_PUBLIC_` variable, GitHub or this chat.

If `account_email` is needed later, Kakao may require additional app permissions. It is unnecessary for a basic account tied to check-ins. Email-less Kakao and Google sign-ins can create separate accounts; a deliberate authenticated account-linking flow is a later feature, not an assumption based on a matching nickname.

## 5. Create the private profile table

1. Open `supabase/manual/20261004_account_profiles.sql` in GitHub.
2. Copy the file's SQL.
3. In the **Taco Map Supabase project**, open **SQL Editor > New Query**.
4. Paste and click **Run**. The last result is the profile count.

The script creates a minimal profile for new and existing Supabase users. It is safe to rerun for this first-phase schema and preserves existing names/avatars. If the profile column names or policy names differ, it stops for review. This guard does not inspect every existing type, constraint, or trigger; a developer must review any pre-existing profiles table before running it. This only adds account data; it does not enable a provider by itself.

## 6. Check the login flow

1. Open <https://taco-tracker-alpha.vercel.app/en/login> after the account code has been deployed.
2. Sign in with Google, return to Taco Map, refresh and confirm the account remains signed in.
3. Sign out and repeat with Kakao.
4. Test the Korean login at <https://taco-tracker-alpha.vercel.app/login>.
5. In Supabase, confirm **Authentication > Users** contains the account and **Table Editor > profiles** has its matching ID.

If Google says `redirect_uri_mismatch`, compare the exact copied Supabase callback with Google. If Kakao says `KOE006`, check its Login Redirect URI; `KOE004` indicates Kakao Login is off. If Kakao lacks email permission, check **Allow users without an email**. A generic database signup error can indicate the profile trigger failed; inspect Supabase logs rather than disabling profile security.

## What this phase secures

`public.profiles` contains only the Supabase user ID, display name, optional HTTPS avatar URL and timestamps. The initial trigger deliberately uses harmless defaults, so incomplete provider metadata cannot break account creation or grant privileges. Emails and credentials remain in Supabase Auth, outside this public table.

RLS lets a signed-in member read only their own profile. Column grants allow them to edit only `display_name` and `avatar_url`. They cannot insert another person's profile, change an ID or timestamp, delete a profile, edit the restaurant directory, or become an administrator through metadata. Public profile cards will require an intentional later read policy exposing only approved display fields.

Google/Kakao accounts themselves are enough to start login. A separate profile is useful now as the stable owner record for future activity, without building those features prematurely.

The migration passed an embedded PostgreSQL check for signup/backfill, owner access versus a second user, denied anonymous reads, denied ID/timestamp edits and inserts/deletes, malformed metadata, repeat runs and deletion cascades. The live Supabase project and actual provider sign-in still require the setup and end-to-end checks above.

## Later check-ins, reviews and photo ownership

No activity tables or storage upload permissions are added by this SQL. The next phase should:

- Link each activity row to the authenticated profile ID and restaurant ID. Inserts require `auth.uid() = user_id`; update/delete require the same ownership check.
- Keep moderation status server-controlled, with public reads restricted to published content. Grant edits only to user content columns, not `user_id`, approval flags or moderator fields.
- Store photo uploads in a restricted bucket under the member's UUID. Storage policies must check the authenticated owner's UUID and a trusted activity association. Validate file size/type, establish photo-use rights, and decide moderation before public display.
- Keep restaurant ownership/advertiser status and admin privileges in trusted, separately managed records. Never infer them from `user_metadata`, social account names or a browser-submitted flag.

## Official references

- Supabase Google: <https://supabase.com/docs/guides/auth/social-login/auth-google>
- Supabase Kakao, including no-email support: <https://supabase.com/docs/guides/auth/social-login/auth-kakao>
- Supabase redirect configuration: <https://supabase.com/docs/guides/auth/redirect-urls>
- Supabase user/profile lifecycle: <https://supabase.com/docs/guides/auth/managing-user-data>
- Supabase row security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase column privileges: <https://supabase.com/docs/guides/database/postgres/column-level-security>
- Google OAuth web setup: <https://developers.google.com/identity/protocols/oauth2/web-server>
- Kakao Login settings, redirect URI and secrets: <https://developers.kakao.com/docs/en/kakaologin/prerequisite>
