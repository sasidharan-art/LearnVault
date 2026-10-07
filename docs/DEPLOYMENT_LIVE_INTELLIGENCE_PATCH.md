# LearnVault — Production Live + Intelligence Patch

This is an incremental patch for the already-deployed LearnVault application.

1. Push the updated project to the existing GitHub repository.
2. Run `database/PRODUCTION_LIVE_INTELLIGENCE_PATCH.sql` once against the existing Aiven `learnvault_db` database.
3. Redeploy the existing Render backend from the latest Git commit.
4. Redeploy the existing Vercel frontend from the same commit.
5. Test Faculty Live Classes and Faculty Early Risk Monitor before testing Student/Admin flows.

The patch does not drop or replace existing application data.
