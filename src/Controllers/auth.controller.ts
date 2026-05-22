import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { UserModel } from "../models/User.model";
import { AuthUser } from "../middlewares/auth";
import { RecruiterProfileModel } from "../models/RecruiterProfile.model";
import { issueVerificationCode, consumeVerificationCode } from "../services/verification";
import { sendSuccess, sendError } from "../utils/response";
import { logger } from "../utils/logger";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const AuthController = {
    async register(req: Request, res: Response) {
        try {
            const { email, password, fullName, fullname, phoneNumber, role, companyName } = req.body;
            const name = fullName || fullname;
            const requestedRole = role || "recruiter";
            if (!email || !password || !name || !phoneNumber) {
                return sendError(res, 400, "email, password, fullName, phoneNumber are required", "BAD_REQUEST");
            }
            if (!["applicant", "recruiter", "admin"].includes(requestedRole)) {
                return sendError(res, 400, "Invalid role", "BAD_REQUEST");
            }
            if (requestedRole === "recruiter" && !companyName) {
                return sendError(res, 400, "companyName is required for recruiter accounts", "BAD_REQUEST");
            }
            const existingUser = await UserModel.findOne({ email });
            if (existingUser) {
                return sendError(res, 409, "User already exists", "CONFLICT");
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
                emailVerified: false,
                lastLoginAt: new Date()
            });

            if (requestedRole === "recruiter") {
                await RecruiterProfileModel.create({
                    user: newUser._id,
                    companyName: String(companyName),
                });
            }

            const code = await issueVerificationCode(email, 'register', 15);
            const devCode = process.env.NODE_ENV !== 'production' ? code : undefined;

            return sendSuccess(res, {
                message: "Account created. Please verify your email with the OTP sent.",
                email,
                requiresVerification: true,
                ...(devCode && { devCode })
            }, 201);
        } catch (error) {
            logger.error("Registration error", error);
            return sendError(res, 500, "Internal server error during registration");
        }
    },

    async verifyRegistration(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { email, code } = req.body;

            if (!email || !code) {
                return sendError(res, 400, "email and code are required", "BAD_REQUEST");
            }

            const isValid = await consumeVerificationCode(email, 'register', code);
            if (!isValid) {
                return sendError(res, 400, "Invalid or expired verification code", "BAD_REQUEST");
            }

            const user = await UserModel.findOne({ email });
            if (!user) {
                return sendError(res, 404, "User not found", "NOT_FOUND");
            }

            user.emailVerified = true;
            await user.save();

            const payload: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });

            return sendSuccess(res, {
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
            logger.error("Verification error", error);
            return sendError(res, 500, "Internal server error during verification");
        }
    },

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return sendError(res, 400, "All fields are required", "BAD_REQUEST");
            }
            const user = await UserModel.findOne({ email });
            if (!user) {
                return sendError(res, 401, "Invalid credentials", "UNAUTHORIZED");
            }
            if (user.deletedAt) {
                return sendError(res, 403, "Account has been deleted", "FORBIDDEN");
            }
            if (!user.isActive) {
                return sendError(res, 403, "Account is deactivated", "FORBIDDEN");
            }
            const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordMatch) {
                return sendError(res, 401, "Invalid credentials", "UNAUTHORIZED");
            }

            const code = await issueVerificationCode(email, 'login_otp', 15);
            const devCode = process.env.NODE_ENV !== 'production' ? code : undefined;

            return sendSuccess(res, {
                message: "OTP sent to your email. Please verify to complete login.",
                email,
                requiresVerification: true,
                ...(devCode && { devCode })
            });
        } catch (error) {
            logger.error("Login error", error);
            return sendError(res, 500, "Internal server error during login");
        }
    },

    async verifyLogin(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { email, code } = req.body;

            if (!email || !code) {
                return sendError(res, 400, "email and code are required", "BAD_REQUEST");
            }

            const isValid = await consumeVerificationCode(email, 'login_otp', code);
            if (!isValid) {
                return sendError(res, 400, "Invalid or expired verification code", "BAD_REQUEST");
            }

            const user = await UserModel.findOne({ email });
            if (!user) {
                return sendError(res, 404, "User not found", "NOT_FOUND");
            }

            user.lastLoginAt = new Date();
            await user.save();

            const payload: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });

            return sendSuccess(res, {
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
            logger.error("Login verification error", error);
            return sendError(res, 500, "Internal server error during login verification");
        }
    },

    async resendOtp(req: Request, res: Response) {
        try {
            const { email, purpose } = req.body;

            if (!email || !purpose) {
                return sendError(res, 400, "email and purpose are required", "BAD_REQUEST");
            }

            if (!['register', 'login_otp', 'reset_password'].includes(purpose)) {
                return sendError(res, 400, "Invalid purpose", "BAD_REQUEST");
            }

            const user = await UserModel.findOne({ email });
            if (!user) {
                return sendError(res, 404, "User not found", "NOT_FOUND");
            }

            const code = await issueVerificationCode(email, purpose as 'register' | 'login_otp' | 'reset_password', 15);
            const devCode = process.env.NODE_ENV !== 'production' ? code : undefined;

            return sendSuccess(res, {
                message: "OTP resent successfully",
                ...(devCode && { devCode })
            });
        } catch (error) {
            logger.error("Resend OTP error", error);
            return sendError(res, 500, "Internal server error while resending OTP");
        }
    },

    async googleSignIn(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { credential } = req.body;

            if (!credential) {
                return sendError(res, 400, "Google credential is required", "BAD_REQUEST");
            }

            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                return sendError(res, 400, "Invalid Google token", "BAD_REQUEST");
            }

            const { email, name, picture, sub: googleId, email_verified } = payload;

            let user = await UserModel.findOne({ $or: [{ email }, { googleId }] });

            if (user) {
                if (!user.googleId) {
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

                return sendSuccess(res, {
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
                return sendSuccess(res, {
                    message: "No account found with this email. Please register first.",
                    requiresRegistration: true,
                    googleEmail: email,
                    googleName: name,
                    googlePicture: picture
                }, 404);
            }
        } catch (error) {
            logger.error("Google Sign-In error", error);
            return sendError(res, 500, "Internal server error during Google Sign-In");
        }
    }
}
