# OTP Email Verification Setup

This application now supports OTP (One-Time Password) verification for both registration and login flows using Gmail SMTP.

## Features

- **Registration OTP**: Users receive a 6-digit code via email after registration
- **Login OTP**: Users receive a 6-digit code via email when logging in
- **Resend OTP**: Users can request a new code if the previous one expired
- **Gmail SMTP**: Secure email delivery using Gmail's SMTP server

## Gmail SMTP Setup

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification

### Step 2: Generate App Password
1. Visit [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and your device
3. Click "Generate"
4. Copy the 16-character password (remove spaces)

### Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # Your 16-char app password
SMTP_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Intore
```

**Important Notes:**
- Use port `587` for TLS (recommended)
- Use port `465` for SSL (alternative)
- The app password is different from your regular Gmail password
- Never commit your `.env` file to version control

## API Endpoints

### 1. Register (Step 1)
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "John Doe",
  "phoneNumber": "+250788123456",
  "role": "recruiter",
  "companyName": "Tech Corp"
}
```

**Response:**
```json
{
  "message": "Account created. Please verify your email with the OTP sent.",
  "email": "user@example.com",
  "requiresVerification": true,
  "devCode": "123456"  // Only in development mode
}
```

### 2. Verify Registration (Step 2)
```http
POST /auth/verify-registration
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "message": "Email verified successfully",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "recruiter",
    "fullName": "John Doe"
  }
}
```

### 3. Login (Step 1)
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "OTP sent to your email. Please verify to complete login.",
  "email": "user@example.com",
  "requiresVerification": true,
  "devCode": "654321"  // Only in development mode
}
```

### 4. Verify Login (Step 2)
```http
POST /auth/verify-login
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "654321"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "recruiter",
    "fullName": "John Doe"
  }
}
```

### 5. Resend OTP
```http
POST /auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "login_otp"  // or "register" or "reset_password"
}
```

**Response:**
```json
{
  "message": "OTP resent successfully",
  "devCode": "789012"  // Only in development mode
}
```

## OTP Configuration

- **Code Length**: 6 digits
- **Expiration**: 15 minutes
- **Purpose Types**: `register`, `login_otp`, `reset_password`
- **One-Time Use**: Each code can only be used once

## Development Mode

In development (`NODE_ENV !== 'production'`), the API responses include a `devCode` field with the actual OTP for testing purposes. This is automatically removed in production.

## Security Features

- Codes expire after 15 minutes
- Each code can only be used once
- Failed verification attempts don't reveal if the email exists
- Passwords are hashed with bcrypt
- JWT tokens expire after 7 days

## Troubleshooting

### Email Not Sending

1. **Check logs**: Look for `[sendMail]` messages in console
2. **Verify credentials**: Ensure Gmail app password is correct (16 characters)
3. **Check 2FA**: Make sure 2-factor authentication is enabled on Gmail
4. **Check spam folder**: OTP emails might be filtered
5. **Port issues**: Try port 465 if 587 doesn't work
6. **Gmail security**: Check if Gmail blocked the sign-in attempt

### Invalid Code Errors

- Code may have expired (15 minutes)
- Code may have already been used
- Email address might not match
- Use the resend endpoint to get a new code

## Frontend Integration Example

```typescript
// Registration flow
const register = async (userData) => {
  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await response.json();
  
  if (data.requiresVerification) {
    // Show OTP input form
    showOtpForm(data.email);
  }
};

const verifyRegistration = async (email, code) => {
  const response = await fetch('/auth/verify-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  const data = await response.json();
  
  if (data.token) {
    // Store token and redirect to dashboard
    localStorage.setItem('token', data.token);
    window.location.href = '/dashboard';
  }
};
```

## Database Schema

The `VerificationToken` model stores OTP codes:

```typescript
{
  email: string;
  code: string;
  purpose: 'register' | 'reset_password' | 'login_otp';
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Next Steps

1. Update your `.env` file with email credentials
2. Test the registration flow
3. Test the login flow
4. Update frontend to handle OTP verification
5. Consider adding rate limiting to prevent abuse
