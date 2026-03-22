# Zenvylo v3 — Update Changelog

## What Changed (Summary)

**46 files, 4,753 lines of code** across a clean Vite + React project.

### Plans & Billing
- **6 plans now**: Free → Starter ($9) → Growth ($19) → Pro ($39) → Scale ($79) → Enterprise (contact only)
- **Free plan**: 3 scans/month, resets on the 1st, tracked in `scanQuota.js`
- **Pro trial**: 7-day trial, starts only when user picks Pro. Auto-downgrades to Free if expired
- **Enterprise**: Opens a "contact support@zenvylo.com" page — no subscription or trial
- **Old trial logic removed**: `isTrialActive` and `trialDaysLeft` moved from `constants/plans.js` to dedicated `utils/trial.js`

### New Files Created

| File | What It Does |
|---|---|
| `src/utils/scanQuota.js` | Free plan: tracks 3 scans/month in localStorage, auto-resets monthly |
| `src/utils/trial.js` | Pro trial: `startTrial()`, `isTrialActive()`, `getTrialDaysLeft()`, `checkTrialExpiry()` |
| `src/utils/profanityFilter.js` | Obfuscation-resistant filter: normalizes leetspeak, strips symbols, blocks banned words |
| `src/utils/roles.js` | Role system: `isAdmin()`, `isModerator()`, `getRoleBadge()`, `getDefaultRole()` |
| `src/components/ui/PasswordInput.jsx` | Password field with show/hide toggle |
| `src/components/ui/RoleBadge.jsx` | Crown/shield icons next to admin/mod usernames |
| `src/components/ui/Avatar.jsx` | Profile image with fallback initials, plan-colored background |
| `src/components/pages/EnterprisePage.jsx` | "Contact support@zenvylo.com" page |
| `src/components/pages/SupportPage.jsx` | Support email + 10-question FAQ |
| `src/components/community/ReportModal.jsx` | Report messages/users with 6 preset reasons + detail field |
| `src/components/community/HoverCard.jsx` | Hover over usernames → shows avatar, role, plan, join date, report button |
| `src/components/admin/AdminDashboard.jsx` | Full admin panel: user list, role management, ban, reports |
| `public/favicon.ico` | Zenvylo target icon, lime on dark, multi-size ICO |
| `public/icon-192.png` | 192px PNG for web manifest / Apple touch |
| `supabase-schema-v2.sql` | Updated schema: role, banned, profile_image_url, reports table, RLS |

### Files Updated

| File | Changes |
|---|---|
| `src/constants/plans.js` | Added `free` and `enterprise` plans. Removed `isTrialActive`/`trialDaysLeft`. Added `PLAN_ORDER`, `isPaidPlan`, `isEnterprise` |
| `src/utils/db.js` | Added `getAllUsers()`, `getReports()`, `saveReport()`, `getProfileImage()`, `saveProfileImage()`. Import `getDefaultRole` |
| `src/components/auth/Auth.jsx` | Password confirmation field, visibility toggle, min 6 chars validation, passwords-must-match check, `role: getDefaultRole(email)`, default plan `"free"`, banned user check on login |
| `src/components/search/SearchModal.jsx` | Free plan scan tracking via `scanQuota.js`, separate increment logic for free vs paid |
| `src/components/settings/SubscriptionPage.jsx` | Full rewrite: 6-plan grid, Enterprise contact-only flow, Pro trial button, `PLAN_ORDER` rendering |
| `src/components/landing/LandingPage.jsx` | Fixed price display for Free ($0→"Free") and Enterprise (hidden from grid). Fixed `p.trial` → `p.trialDays` |
| `src/components/home/Home.jsx` | Added `isTrialActive` import from `utils/trial` |
| `src/App.jsx` | Added Enterprise, Support, Admin routes. Trial expiry check on load. Admin-only nav item. Free plan scan display. Trial banner in sidebar |
| `index.html` | Added favicon + apple-touch-icon references |

---

## What You Need to Do

### Right Now (5 min)
1. Unzip the project
2. `npm install && npm run dev`
3. Test: sign up → you're on Free plan → scan 3 times → should block
4. Test: go to Subscription → pick Pro → trial starts → 7 days shown

### Before Launch (when you set up Supabase)
1. Run `supabase-schema-v2.sql` in Supabase SQL Editor
2. Create a storage bucket called `avatars` (public)
3. Replace `src/utils/db.js` function bodies with Supabase queries (exports stay the same)
4. Replace `admin@zenvylo.com` in `src/utils/roles.js` with your real email

### Profile Images
Currently stored as base64 in localStorage (works for testing). For production:
1. Create Supabase storage bucket `avatars`
2. In Settings page, add a file upload that:
   - Validates type (image/jpeg, image/png, image/webp) and size (<2MB)
   - Uploads to `avatars/{user_id}/avatar.{ext}`
   - Saves the public URL to `profiles.profile_image_url`
3. The `Avatar.jsx` component already reads from `user.profileImageUrl` — it'll just work

### Community Enhancements
The profanity filter and report modal are built and ready to wire into CommunityPage:
```jsx
import { filterMessage } from '../../utils/profanityFilter'
import ReportModal from './ReportModal'
import HoverCard from './HoverCard'
```
When posting a message, call `filterMessage(text)` before saving. If `!result.ok`, show `result.reason` as an error. The full CommunityPage integration requires ~20 lines of changes — I left the existing CommunityPage intact so it doesn't break, and you wire in the new components when ready.

---

## Ideas for Later

1. **Email notifications**: When a report is filed, email the admin. Use Supabase Edge Functions + Resend
2. **Mod log**: Track every admin action (ban, role change, report resolution) for accountability
3. **Profile pages**: `/user/{id}` pages showing public stats, plan badge, lead count
4. **Message edit/delete**: Let users edit within 5 minutes, soft-delete with `deleted_at` timestamp
5. **Rate limiting**: Prevent scan spam — max 1 scan per 30 seconds, enforced server-side
6. **Referral tracking dashboard**: Show referral stats, who signed up, bonus scans earned
7. **Onboarding flow v2**: Interactive walkthrough that opens the scan modal on final step
8. **Dark/light mode**: Your CSS variables are already set up for it — add a toggle that swaps `:root` values
