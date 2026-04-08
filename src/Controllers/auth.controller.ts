import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { UserModel } from "../models/User.model";
import { AuthUser } from "../middlewares/auth";
import { RecruiterProfileModel } from "../models/RecruiterProfile.model";
import { issueVerificationCode, consumeVerificationCode } from "../services/verification";
dotenv.config();

export const AuthController ={
    async register(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { email, password, fullName, fullname, phoneNumber, role, companyName } = req.body;
            const name = fullName || fullname;
            const requestedRole = role || "applicant";
            if(!email || !password || !name || !phoneNumber){
                return res.status(400).json({message:"email, password, fullName, phoneNumber are required"});
            }
            if(!["applicant","recruiter","admin"].includes(requestedRole)){
                return res.status(400).json({message:"Invalid role"});
            }
            if(requestedRole === "recruiter" && !companyName){
                return res.status(400).json({message:"companyName is required for recruiter accounts"});
            }
            const existingUser = await UserModel.findOne({email});
            if(existingUser){
                return res.status(409).json({message:"User already exists"});
            }
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password,salt);

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

            const code = await issueVerificationCode(String(email).toLowerCase(), "register", 15);

            // Do not issue auth token until verified.
            return res.status(201).json({
                message: "User created. Verification required.",
                verificationRequired: true,
                email: newUser.email,
                // For local/dev convenience only (email is also sent when SMTP is configured).
                ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
                user: {
                    id: newUser._id.toString(),
                    email: newUser.email,
                    role: newUser.role,
                    fullName: newUser.fullName
                }
            });
        } catch (error) {
            console.log("Registration error", error);
            return res.status(500).json({message:"Internal server error during registration"});
        }
    },

    async verify(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const { email, code } = req.body || {};
            if (!email || !code) {
                return res.status(400).json({ message: "email and code are required" });
            }
            const ok = await consumeVerificationCode(String(email).toLowerCase(), "register", String(code));
            if (!ok) {
                return res.status(400).json({ message: "Invalid or expired verification code" });
            }
            const user = await UserModel.findOneAndUpdate(
                { email: String(email).toLowerCase() },
                { $set: { emailVerified: true } },
                { new: true }
            );
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const payload: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
            return res.status(200).json({
                verified: true,
                token,
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    role: user.role,
                    fullName: user.fullName
                }
            });
        } catch (error) {
            console.log("Verify error", error);
            return res.status(500).json({ message: "Internal server error during verification" });
        }
    },

    async resendCode(req: Request, res: Response) {
        try {
            const { email, purpose } = req.body || {};
            if (!email || !purpose) {
                return res.status(400).json({ message: "email and purpose are required" });
            }
            if (purpose !== "register" && purpose !== "reset_password") {
                return res.status(400).json({ message: "Invalid purpose" });
            }
            const code = await issueVerificationCode(String(email).toLowerCase(), purpose, 15);
            return res.status(200).json({
                ok: true,
                ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {})
            });
        } catch (error) {
            console.log("Resend code error", error);
            return res.status(500).json({ message: "Internal server error during resend" });
        }
    },

    async login(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
            const {email,password} = req.body;
            if(!email || !password){
                return res.status(400).json({message:"All fields are required"});
            }
            const user = await UserModel.findOne({email});
            if(!user){
                return res.status(401).json({message: "Invalid credentials"});
            }
            if(user.deletedAt){
                return res.status(403).json({message: "Account has been deleted"});
            }
            if(!user.isActive){
                return res.status(403).json({message: "Account is deactivated"});
            }
            if(!user.emailVerified){
                return res.status(403).json({message: "Email not verified. Please verify your account."});
            }
            const isPasswordMatch = await bcrypt.compare(password,user.passwordHash);
            if(!isPasswordMatch){
                return res.status(401).json({message: "Invalid credentials"});
            }
            user.lastLoginAt = new Date();
            await user.save();

            const payload: AuthUser = {
                id: user._id.toString(),
                email: user.email,
                role: user.role
            };

            const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
            return res.status(200).json({message:"Login successful",
                token,
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    role: user.role,
                    fullName: user.fullName
                }
            });
        } catch (error) {
            console.log("Login error", error);
            return res.status(500).json({message:"Internal server error during login"});
        }
    }
}
