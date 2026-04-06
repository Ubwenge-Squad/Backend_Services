import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { UserModel } from "../models/User.model";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const AuthController ={
    async register(req:Request, res:Response){
        try {
            const {email, password, fullname , phoneNumber} = req.body;
            if(!email || !password || !fullname || !phoneNumber){
                return res.status(400).json({message:"All fields are required"});
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
                fullName: fullname,
                phoneNumber,
                role:"applicant",
                isActive:true,
                emailVerified:false
            });

            const token = jwt.sign({
                id: newUser._id,
                email:newUser.email,
                role:newUser.role
            },JWT_SECRET!,{expiresIn:"7d"});
            return res.status(201).json({message:"User created successfully",
                token,
                user: {
                    id:newUser._id,
                    email:newUser.email,
                    role:newUser.role,
                    fullName:newUser.fullName
                }
            });
        } catch (error) {
            console.log("Registration error", error);
            return res.status(500).json({message:"Internal server error during registration"});
        }
    },

    async login( req: Request, res:Response){
        try {
            const {email,password} = req.body;
            if(!email || !password){
                return res.status(400).json({message:"All fields are required"});
            }
            const user = await UserModel.findOne({email});
            if(!user){
                return res.status(401).json({message: "Invalid credentials"});
            }
            const isPasswordMatch = await bcrypt.compare(password,user.passwordHash);
            if(!isPasswordMatch){
                return res.status(401).json({message: "Invalid credentials"});
            }
            user.lastLoginAt = new Date();
            await user.save();
            const token = jwt.sign({
                id: user._id,
                email:user.email,
                role:user.role
            },JWT_SECRET!,{expiresIn:"7d"});
            return res.status(200).json({message:"Login successful",
                token,
                user: {
                    id:user._id,
                    email:user.email,
                    role:user.role,
                    fullName:user.fullName
                }
            });
        } catch (error) {
            console.log("Login error", error);
            return res.status(500).json({message:"Internal server error during login"});
        }
    }
}
