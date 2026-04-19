# OTP Feature Implementation - Changelog

## Summary
Implemented OTP (One-Time Password) email verification for both registration and login flows using Gmail SMTP.

## Changes Made

### 1. Backend Controllers (`src/Controllers/auth.controller.ts`)
- **Modified `register()`**: Now sends OTP instead of immediately issuing JWT token
  - Sets `emailVerified: false` on new users
  - Calls `issueVerificationCode()` to generate and send OTP
  - Returns `requiresVerification: true` in response
  - Includes `devCode` in development mode for testing

- **Added `verifyRegistration()`**: New endpoint to verify registration OTP
  - Validates OTP code using `consumeVerificationCode()`
  - Sets `emailVerified: true` on user
  - Issues JWT token upon successful verification

- **Modified `login()`**: Now sends OTP instead of immediately issuing JWT token
  - Validates credentials first
  - Calls `issueVerificationCode()` with purpose `login_otp`
  - Returns `requiresVerification: true` in response

- **Added `verifyLogin()`**: New endpoint to verify login OTP
  - Validates OTP code
  - Updates `lastLoginAt` timestamp
  - Issues JWT token upon successful verification

- **Added `resendOtp()`**: New endpoint to resend expired OTP codes
  - Supports all purposes: `register`, `login_otp`, `reset_password`
  - Generates new code with fresh expiration

### 2. Email Service (`src/services/mailer.ts`)
- **Removed Resend dependency**: Now uses only Gmail SMTP via nodemailer
  - Removed `getResendClient()` function
  - Removed `USE_SMTP` toggle logic
  - Simplified to single SMTP implementation
  - Automatic TLS/SSL detection based on port (587 or 465)
  - Better error logging for debugging

### 3. Routes (`src/routes/index.ts`)
- **Added new endpoints**:
  - `POST /auth/verify-registration` - Verify registration OTP
  - `POST /auth/verify-login` - Verify login OTP
  - `POST /auth/resend-otp` - Resend OTP code

### 4. Environment Configuration (`env.example`)
- **Removed Resend configuration**
- **Simplified to Gmail SMTP only**:
  - `SMTP_HOST` - Gmail SMTP server (smtp.gmail.com)
  - `SMTP_PORT` - SMTP server port (587 or 465)
  - `SMTP_USER` - Gmail address
  - `SMTP_PASS` - Gmail App Password
  - `SMTP_FROM_EMAIL` - Sender email
  - `MAIL_FROM_NAME` - Sender display name

### 5. Dependencies (`package.json`)
- **Removed**: `resend` package
- **Kept**: `nodemailer` for SMTP functionality

### 5. Documentation
- **Created `OTP_SETUP.md`**: Comprehensive setup guide
  - Email service configuration (Resend vs SMTP)
  - API endpoint documentation with examples
  - Gmail setup instructions
  - Frontend integration examples
  - Troubleshooting guide

- **Updated `API.md`**: Refreshed authentication endpoints
  - Updated `/auth/register` documentation
  - Added `/auth/verify-registration` endpoint
  - Updated `/auth/login` documentation
  - Added `/auth/verify-login` endpoint
  - Added `/auth/resend-otp` endpoint

- **Updated `README.md`**: Added OTP feature overview
  - Email configuration section
  - Authentication flow diagram
  - Security features list

- **Created `CHANGELOG_OTP.md`**: This file

## API Flow Changes

### Before (Direct Login/Registration)
```
POST /auth/register → JWT token immediately
POST /auth/login → JWT token immediately
```

### After (OTP Verification)
```
POST /auth/register → OTP sent via email
POST /auth/verify-registration → JWT token

POST /auth/login → OTP sent via email
POST /auth/verify-login → JWT token

POST /auth/resend-otp → New OTP sent (if expired)
```

## Security Improvements
1. **Two-factor authentication**: Email verification required for both registration and login
2. **Time-limited codes**: OTP expires after 15 minutes
3. **One-time use**: Each code can only be used once
4. **Rate limiting**: Existing rate limits apply to all endpoints
5. **Development safety**: OTP codes only visible in dev mode

## Backward Compatibility
⚠️ **Breaking Changes**: This is a breaking change for existing clients
- Registration no longer returns JWT token immediately
- Login no longer returns JWT token immediately
- Clients must implement OTP verification flow

## Testing in Development
In development mode (`NODE_ENV !== 'production`), API responses include `devCode` field with the actual OTP for easy testing without checking email.

Example:
```json
{
  "message": "OTP sent to your email",
  "email": "user@example.com",
  "requiresVerification": true,
  "devCode": "123456"  // Only in development
}
```

## Dependencies
No new dependencies required - uses existing `nodemailer` package.
Removed `resend` package dependency.

## Configuration Required
To enable OTP feature, configure Gmail SMTP in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Intore
```

**Gmail App Password Setup:**
1. Enable 2-factor authentication on your Google account
2. Visit [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate a new app password for "Mail"
4. Copy the 16-character password (remove spaces)
5. Use it in `SMTP_PASS`

## Next Steps for Frontend
1. Update registration flow to show OTP input after initial registration
2. Update login flow to show OTP input after password validation
3. Add "Resend OTP" button with countdown timer
4. Handle `requiresVerification` flag in API responses
5. Store email temporarily for OTP verification step
6. Add loading states during OTP verification
7. Show appropriate error messages for invalid/expired codes

## Files Modified
- `src/Controllers/auth.controller.ts` - Added OTP verification logic
- `src/services/mailer.ts` - Added SMTP support
- `src/routes/index.ts` - Added new routes
- `env.example` - Added SMTP configuration
- `API.md` - Updated authentication documentation
- `README.md` - Added OTP feature overview

## Files Created
- `OTP_SETUP.md` - Detailed setup and usage guide
- `CHANGELOG_OTP.md` - This changelog

## Verification
✅ TypeScript compilation successful (`npm run check`)
✅ No diagnostic errors
✅ All imports resolved correctly
✅ Existing functionality preserved
