import mongoose from 'mongoose';

export async function connectMongo(): Promise<void> {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		throw new Error('MONGODB_URI is not set');
	}
	mongoose.set('strictQuery', true);
	await mongoose.connect(uri, {
		serverSelectionTimeoutMS: 5000
	} as any);
	console.log('Connected to MongoDB');
}

