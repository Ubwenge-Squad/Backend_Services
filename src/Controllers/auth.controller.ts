import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { UserModel } from "../models/User.model";
import id from "zod/v4/locales/id.js";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const AuthController ={
    async register(req:Request, res:Response){
        try {
            const {email, password, fullname , phoneMumber} = req.body;
            if(!email || !password || !fullname || !phoneMumber){
                return res.status(400).json({message:"All fields are required"});
            }
            const exiseingUser = await UserModel.findOne({email});
            if(exiseingUser){
                return res.status(409).json({message:"User already exists"});
            }
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password,salt);

            const newUser = await UserModel.create({
                email,
                password:passwordHash,
                fullname,
                phoneMumber,
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
                    fullname:newUser.fullname
                }
            });
        } catch (error) {
            console.log("Registration error", error);
            return res.status(500).json({message:"Internal server error during registration"});
        }
    }
}