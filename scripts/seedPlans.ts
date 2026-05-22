import mongoose from 'mongoose';
import { SubscriptionPlanModel } from '../src/models/SubscriptionPlan.model';

const PLANS = [
	{
		name: 'Free',
		code: 'free' as const,
		price: 0,
		currency: 'USD',
		interval: 'month' as const,
		sortOrder: 0,
		features: {
			'AI Screening': true,
			'Email Support': true,
			'Basic Analytics': true,
		},
		quotas: {
			screeningsPerMonth: 10,
			activeJobs: 1,
			candidatesPerJob: 20,
			aiChatPerDay: 5,
			teamMembers: 1,
			whatsAppAccess: false,
			umuravaSync: false,
			biasReports: false,
			apiAccess: false,
			prioritySupport: false,
		},
	},
	{
		name: 'Growth',
		code: 'growth' as const,
		price: 29,
		currency: 'USD',
		interval: 'month' as const,
		sortOrder: 1,
		features: {
			'AI Screening': true,
			'WhatsApp Access': true,
			'Umurava Sync': true,
			'Bias Reports': true,
			'Priority Email Support': true,
			'Team Accounts (5)': true,
		},
		quotas: {
			screeningsPerMonth: 100,
			activeJobs: 10,
			candidatesPerJob: 500,
			aiChatPerDay: 50,
			teamMembers: 5,
			whatsAppAccess: true,
			umuravaSync: true,
			biasReports: true,
			apiAccess: false,
			prioritySupport: false,
		},
	},
	{
		name: 'Enterprise',
		code: 'enterprise' as const,
		price: 199,
		currency: 'USD',
		interval: 'month' as const,
		sortOrder: 2,
		features: {
			'Unlimited Screenings': true,
			'Full WhatsApp Access': true,
			'Umurava Sync': true,
			'Bias Reports': true,
			'API Access': true,
			'Priority Support': true,
			'Team Accounts (Unlimited)': true,
			'Data Residency': true,
			'On-prem Option': true,
		},
		quotas: {
			screeningsPerMonth: -1,
			activeJobs: -1,
			candidatesPerJob: -1,
			aiChatPerDay: -1,
			teamMembers: -1,
			whatsAppAccess: true,
			umuravaSync: true,
			biasReports: true,
			apiAccess: true,
			prioritySupport: true,
		},
	},
];

async function seed() {
	const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/intore';
	await mongoose.connect(uri);
	console.log('Connected to MongoDB');

	for (const plan of PLANS) {
		await SubscriptionPlanModel.findOneAndUpdate(
			{ code: plan.code },
			{ $set: plan },
			{ upsert: true, new: true }
		);
		console.log(`  ✅ ${plan.name} (${plan.code})`);
	}

	await mongoose.disconnect();
	console.log('Done. Plans seeded.');
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
