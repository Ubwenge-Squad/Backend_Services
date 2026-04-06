import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.model";

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
                res.status(409).json({message:"User already exists"});
            }
        } catch (error) {
            
        }
    }
}