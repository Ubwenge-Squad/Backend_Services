# OTP Feature Migration Summary

## What Changed?

The authentication system now requires **email verification via OTP** for both registration and login, using **Gmail SMTP** for email delivery.

## Quick Setup (5 minutes)

### 1. Enable Gmail App Password
```
1. Go to: https://myaccount.google.com/apppasswords
2. Enable 2FA if not already enabled
3. Generate app password for "Mail"
4. Copy the 16-character password
```

### 2. Update .env File
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Intore
```

### 3. Remove Old Package (Optional)
```bash
npm uninstall resend
```

### 4. Test It
```bash
npm run dev
```

## New Authentication Flow

### Before (Old)
```
POST /auth/register → JWT token ✅
POST /auth/login → JWT token ✅
```

### After (New)
```
POST /auth/register → OTP sent 📧
POST /auth/verify-registration + OTP → JWT token ✅

POST /auth/login → OTP sent 📧
POST /auth/verify-login + OTP → JWT token ✅
```

## New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/verify-registration` | POST | Verify OTP after registration |
| `/auth/verify-login` | POST | Verify OTP after login |
| `/auth/resend-otp` | POST | Resend expired OTP |

## Development Mode

In development, API responses include the OTP code:

```json
{
  "message": "OTP sent to your email",
  "email": "user@example.com",
  "requiresVerification": true,
  "devCode": "123456"  // ← Only in development!
}
```

This makes testing easier without checking email.

## Files Changed

### Modified
- ✏️ `src/Controllers/auth.controller.ts` - Added OTP verification logic
- ✏️ `src/services/mailer.ts` - Removed Resend, kept Gmail SMTP only
- ✏️ `src/routes/index.ts` - Added 3 new endpoints
- ✏️ `package.json` - Removed `resend` dependency
- ✏️ `env.example` - Updated with Gmail SMTP config
- ✏️ `README.md` - Updated email configuration section
- ✏️ `API.md` - Updated authentication endpoints

### Created
- 📄 `OTP_SETUP.md` - Detailed setup guide
- 📄 `GMAIL_SETUP_GUIDE.md` - Step-by-step Gmail configuration
- 📄 `CHANGELOG_OTP.md` - Complete change log
- 📄 `OTP_MIGRATION_SUMMARY.md` - This file

## Frontend Changes Needed

Your frontend needs to handle the two-step flow:

```typescript
// 1. Register user
const registerResponse = await fetch('/auth/register', {
  method: 'POST',
  body: JSON.stringify(userData)
});

const data = await registerResponse.json();

if (data.requiresVerification) {
  // 2. Show OTP input form
  const otpCode = prompt('Enter OTP from email:');
  
  // 3. Verify OTP
  const verifyResponse = await fetch('/auth/verify-registration', {
    method: 'POST',
    body: JSON.stringify({
      email: data.email,
      code: otpCode
    })
  });
  
  const verifyData = await verifyResponse.json();
  
  if (verifyData.token) {
    // 4. Store token and redirect
    localStorage.setItem('token', verifyData.token);
    window.location.href = '/dashboard';
  }
}
```

## Security Features

✅ Email verification required  
✅ 6-digit OTP codes  
✅ 15-minute expiration  
✅ One-time use per code  
✅ Resend functionality  
✅ Development mode for testing  

## Testing Checklist

- [ ] Gmail app password generated
- [ ] Environment variables configured
- [ ] Server starts without errors
- [ ] Registration sends OTP email
- [ ] OTP verification works
- [ ] Login sends OTP email
- [ ] Login verification works
- [ ] Resend OTP works
- [ ] Expired codes are rejected
- [ ] Used codes are rejected

## Troubleshooting

### No email received?
1. Check console logs for `[sendMail]` messages
2. Verify Gmail app password is correct
3. Check spam folder
4. Ensure 2FA is enabled on Gmail

### "Invalid credentials" error?
- Use the **app password**, not your Gmail password
- Remove spaces from the 16-character password
- Verify `SMTP_USER` matches your Gmail address

### Port blocked?
- Try port `465` instead of `587`
- Check firewall settings
- Verify network allows SMTP connections

## Need Help?

📖 Read the detailed guides:
- `GMAIL_SETUP_GUIDE.md` - Gmail configuration
- `OTP_SETUP.md` - Complete OTP documentation
- `CHANGELOG_OTP.md` - Technical changes

## Next Steps

1. ✅ Configure Gmail SMTP in `.env`
2. ✅ Test registration flow
3. ✅ Test login flow
4. ⏳ Update frontend to handle OTP verification
5. ⏳ Add OTP input UI components
6. ⏳ Implement resend OTP functionality
7. ⏳ Add countdown timer for OTP expiration
8. ⏳ Test complete user journey

---

**Note:** This is a breaking change. Existing clients must be updated to support the new two-step authentication flow.
