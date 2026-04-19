# Gmail SMTP Setup Guide for OTP Feature

This guide will help you configure Gmail SMTP for sending OTP emails in the Intore application.

## Prerequisites
- A Gmail account
- Access to Google Account settings

## Step-by-Step Setup

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Scroll down to "How you sign in to Google"
3. Click on "2-Step Verification"
4. Follow the prompts to enable 2FA (you'll need your phone)

### Step 2: Generate App Password

1. After enabling 2FA, go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords
2. You may need to sign in again
3. Under "Select app", choose "Mail"
4. Under "Select device", choose "Other (Custom name)"
5. Enter "Intore Backend" or any name you prefer
6. Click "Generate"
7. Google will display a 16-character password (e.g., `abcd efgh ijkl mnop`)
8. **Copy this password** - you won't be able to see it again!

### Step 3: Configure Environment Variables

1. Open your `.env` file in the Backend_Services directory
2. Add or update these variables:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Intore
```

**Important:**
- Replace `your-email@gmail.com` with your actual Gmail address
- Replace `abcdefghijklmnop` with the 16-character app password (remove spaces)
- Use port `587` for TLS (recommended) or `465` for SSL

### Step 4: Test the Configuration

1. Start your backend server:
```bash
npm run dev
```

2. Try registering a new user through your API:
```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "fullName": "Test User",
    "phoneNumber": "+250788123456",
    "role": "recruiter",
    "companyName": "Test Corp"
  }'
```

3. Check the console logs for:
```
[sendMail] Email sent via SMTP to test@example.com
```

4. Check your email inbox for the OTP code

## Troubleshooting

### "Invalid login" or "Username and Password not accepted"
- Make sure you're using the **App Password**, not your regular Gmail password
- Verify that 2-Factor Authentication is enabled
- Check that you copied the entire 16-character password without spaces

### "Connection timeout" or "ETIMEDOUT"
- Check your internet connection
- Try port `465` instead of `587`
- Verify firewall settings aren't blocking SMTP ports

### "Less secure app access"
- This is no longer needed with App Passwords
- App Passwords automatically bypass this restriction

### Emails going to spam
- Add your domain to Gmail's SPF records (for production)
- Ask recipients to mark your emails as "Not Spam"
- Use a professional sender name in `MAIL_FROM_NAME`

### Rate limiting
- Gmail has sending limits:
  - Free accounts: ~500 emails/day
  - Google Workspace: ~2000 emails/day
- For high-volume applications, consider a dedicated email service

## Security Best Practices

1. **Never commit `.env` file**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for documentation

2. **Rotate App Passwords regularly**
   - Delete old app passwords from Google Account settings
   - Generate new ones periodically

3. **Use environment-specific credentials**
   - Different Gmail accounts for dev/staging/production
   - Or use different app passwords for each environment

4. **Monitor usage**
   - Check Gmail's "Sent" folder periodically
   - Watch for unusual activity

## Alternative SMTP Providers

If you prefer not to use Gmail, here are alternatives:

### Outlook/Hotmail
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo Mail
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

### SendGrid (Recommended for Production)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
```

## Production Considerations

For production deployments:

1. **Use a dedicated email service** (SendGrid, Mailgun, AWS SES)
   - Better deliverability
   - Higher sending limits
   - Advanced analytics

2. **Set up SPF, DKIM, and DMARC records**
   - Improves email deliverability
   - Reduces spam classification

3. **Monitor email delivery**
   - Track bounce rates
   - Monitor spam complaints
   - Set up alerts for failures

4. **Implement retry logic**
   - Already handled by nodemailer
   - Consider adding exponential backoff

5. **Use a custom domain**
   - More professional appearance
   - Better trust signals

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a simple email client first
4. Review Gmail's [SMTP documentation](https://support.google.com/mail/answer/7126229)

## Resources

- [Google App Passwords](https://myaccount.google.com/apppasswords)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
- [Nodemailer Documentation](https://nodemailer.com/)
- [SMTP Error Codes](https://www.mailgun.com/blog/email/smtp-error-codes/)
