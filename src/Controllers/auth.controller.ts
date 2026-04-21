import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { UserModel } from "../models/User.model";
import { AuthUser } from "../middlewares/auth";
import { RecruiterProfileModel } from "../models/RecruiterProfile.model";
import { issueVerificationCode, consumeVerificationCode } from "../services/verification";
dotenv.config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const AuthController = {
    async register(req: Request, res: Response) {
        try {
            const { email, password, fullName, fullname, phoneNumber, role, companyName } = req.body;
            const name = fullName || fullname;
            const requestedRole = role || "recruiter";
            if (!email || !password || !name || !phoneNumber) {
                return res.status(400).json({ message: "email, password, fullName, phoneNumber are required" });
            }
            if (!["applicant", "recruiter", "admin"].includes(requestedRole)) {
                return res.status(400).json({ message: "Invalid role" });
            }
            if (requestedRole === "recruiter" && !companyName) {
                return res.status(400).json({ message: "companyName is required for recruiter accounts" });
            }
            const existingUser = await UserModel.findOne({ email });
            if (existingUser) {
                return res.status(409).json({ message: "User already exists" });
            }
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const newUser = await UserModel.create({
                email,
                passwordHash,
                fullName: name,
                phoneNumber,
                role: requestedRole,
                isActive: true,
                emailVerified: false, // require email verification
                lastLoginAt: new Date()
            });

            if (requestedRole === "recruiter") {
                await RecruiterProfileModel.create({
                    user: newUser._id,
                    companyName: String(companyName),
                });
            }

            // Send OTP for email verification
            const code = await issueVerificationCode(email, 'register', 15);
            
            // In development, return the code for testing
            const devCode = process.env.NODE_ENV !== 'production' ? code : undefined;

            return res.status(201).json({
                message: "Account created. Please verify your email with the OTP sent.",
                email,
                requiresVerification: true,
                ...(devCode && { devCode }) // Only in dev mode
            });
        } catch (error) {
            console.log("Registration error", error);
            return res.status(500).json({ message: "Internal server error during registration" });
        }
    },

    async verifyRegistration(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { email, code } = req.body;
            
            if (!email || !code) {
                return res.status(400).json({ message: "email and code are required" });
            }

            const isValid = await consumeVerificationCode(email, 'register', code);
            if (!isValid) {
                return res.status(400).json({ message: "Invalid or expired verification code" });
            }

            const user = await UserModel.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.emailVerified = true;
            await user.save();

            const payload: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });

            return res.status(200).json({
                message: "Email verified successfully",
                token,
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    role: user.role,
                    fullName: user.fullName
                }
            });
        } catch (error) {
            console.log("Verification error", error);
            return res.status(500).json({ message: "Internal server error during verification" });
        }
    },

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: "All fields are required" });
            }
            const user = await UserModel.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: "Invalid credentials" });
            }
            if (user.deletedAt) {
                return res.status(403).json({ message: "Account has been deleted" });
            }
            if (!user.isActive) {
                return res.status(403).json({ message: "Account is deactivated" });
            }
            const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordMatch) {
                return res.status(401).json({ message: "Invalid credentials" });
            }

            // Send OTP for login verification
            const code = await issueVerificationCode(email, 'login_otp', 15);
            
            // In development, return the code for testing
            const devCode = process.env.NODE_ENV !== 'production' ? code : undefined;

            return res.status(200).json({
                message: "OTP sent to your email. Please verify to complete login.",
                email,
                requiresVerification: true,
                ...(devCode && { devCode }) // Only in dev mode
            });
        } catch (error) {
            console.log("Login error", error);
            return res.status(500).json({ message: "Internal server error during login" });
        }
    },

    async verifyLogin(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { email, code } = req.body;
            
            if (!email || !code) {
                return res.status(400).json({ message: "email and code are required" });
            }

            const isValid = await consumeVerificationCode(email, 'login_otp', code);
            if (!isValid) {
                return res.status(400).json({ message: "Invalid or expired verification code" });
            }

            const user = await UserModel.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.lastLoginAt = new Date();
            await user.save();

            const payload: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });

            return res.status(200).json({
                message: "Login successful",
                token,
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    role: user.role,
                    fullName: user.fullName
                }
            });
        } catch (error) {
            console.log("Login verification error", error);
            return res.status(500).json({ message: "Internal server error during login verification" });
        }
    },

    async resendOtp(req: Request, res: Response) {
        try {
            const { email, purpose } = req.body;
            
            if (!email || !purpose) {
                return res.status(400).json({ message: "email and purpose are required" });
            }

            if (!['register', 'login_otp', 'reset_password'].includes(purpose)) {
                return res.status(400).json({ message: "Invalid purpose" });
            }

            const user = await UserModel.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const code = await issueVerificationCode(email, purpose as 'register' | 'login_otp' | 'reset_password', 15);
            
            // In development, return the code for testing
            const devCode = process.env.NODE_ENV !== 'production' ? code : undefined;

            return res.status(200).json({
                message: "OTP resent successfully",
                ...(devCode && { devCode }) // Only in dev mode
            });
        } catch (error) {
            console.log("Resend OTP error", error);
            return res.status(500).json({ message: "Internal server error while resending OTP" });
        }
    },

    async googleSignIn(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { credential } = req.body;

            if (!credential) {
                return res.status(400).json({ message: "Google credential is required" });
            }

            // Verify the Google token
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                return res.status(400).json({ message: "Invalid Google token" });
            }

            const { email, name, picture, sub: googleId, email_verified } = payload;

            // Check if user exists
            let user = await UserModel.findOne({ $or: [{ email }, { googleId }] });

            if (user) {
                // Existing user - just log them in
                if (!user.googleId) {
                    // Link Google account to existing user
                    user.googleId = googleId;
                    user.authProvider = 'google';
                    user.emailVerified = email_verified || true;
                    if (picture && !user.avatarUrl) {
                        user.avatarUrl = picture;
                    }
                    await user.save();
                }

                user.lastLoginAt = new Date();
                await user.save();

                const authPayload: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
                const token = jwt.sign(authPayload, jwtSecret, { expiresIn: "7d" });

                return res.status(200).json({
                    message: "Login successful",
                    token,
                    user: {
                        id: user._id.toString(),
                        email: user.email,
                        role: user.role,
                        fullName: user.fullName,
                        avatarUrl: user.avatarUrl
                    }
                });
            } else {
                // New user - account doesn't exist
                return res.status(404).json({ 
                    message: "No account found with this email. Please register first.",
                    requiresRegistration: true,
                    googleEmail: email,
                    googleName: name,
                    googlePicture: picture
                });
            }
        } catch (error) {
            console.log("Google Sign-In error", error);
            return res.status(500).json({ message: "Internal server error during Google Sign-In" });
        }
    }
}
