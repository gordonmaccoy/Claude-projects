# Google Sheets export setup

Examio requests https://www.googleapis.com/auth/drive.file only when a professor chooses Connect Google Drive in Results → Download. Ordinary Google sign-in does not request Drive access. Choose the Google account associated with the Examio account. On return, select Save to Drive again; Examio does not automatically send grades during sign-in.

In the Google Cloud project whose OAuth web client is configured for Examio Public:
1. APIs & Services → Library → Google Drive API → Enable.
2. Google Auth Platform → Data Access: include the drive.file scope if Google requires it in the consent configuration. Do not request full Drive access.
3. Keep the existing Supabase Public callback URI and Examio branding. No new secret, service account, or Railway variable is required.

An explicit Save to Drive imports the existing styled XLSX as a native Google Sheet in that Google account's Drive. Summary and Detailed each have their own button. The result links to the created Sheet. Existing download/email choices remain available if permission is declined or the API isn't enabled. Provider access/refresh tokens are stripped from persistent login storage; the access token is held only for the current page. A page reload or token expiration may require reconnecting Drive.

Verification: mocked Google upload/denial tests, real local XLSX generation, browser export choices. No real student grades were uploaded. On 2026-11-17, the Google Drive API was enabled and its Enabled status verified in the existing Examio Public project (sigma-cortex-514404-s1). OAuth consent scopes were not changed in Cloud Console; each professor must explicitly connect and approve the app-requested drive.file permission. Google documentation: https://developers.google.com/workspace/drive/api/guides/manage-uploads#import_to_google_docs_types
