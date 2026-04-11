import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { UserModel } from "../models/User.model";
import { AuthUser } from "../middlewares/auth";
import { RecruiterProfileModel } from "../models/RecruiterProfile.model";
dotenv.config();

export const AuthController = {
    async register(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
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
                emailVerified: true, // skip email verification
                lastLoginAt: new Date()
            });

            if (requestedRole === "recruiter") {
                await RecruiterProfileModel.create({
                    user: newUser._id,
                    companyName: String(companyName),
                });
            }

            // Issue token immediately — no email verification required
            const payload: AuthUser = { id: newUser._id.toString(), email: newUser.email, role: newUser.role };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
            return res.status(201).json({
                message: "Account created successfully.",
                token,
                user: {
                    id: newUser._id.toString(),
                    email: newUser.email,
                    role: newUser.role,
                    fullName: newUser.fullName
                }
            });
        } catch (error) {
            console.log("Registration error", error);
            return res.status(500).json({ message: "Internal server error during registration" });
        }
    },

    async login(req: Request, res: Response) {
        try {
            const jwtSecret = process.env.JWT_SECRET!;
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
            console.log("Login error", error);
            return res.status(500).json({ message: "Internal server error during login" });
        }
    }
}
