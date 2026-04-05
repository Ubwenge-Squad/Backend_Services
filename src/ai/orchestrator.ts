import { ModelOutputSchema, WeightConfigSchema } from './types';
import { buildMultiCandidatePrompt } from './prompts';
import { GeminiAiService } from './gemini';
import { getJobWithApplicants } from './retrievers/mongoRetriever';
import { ScreeningRunModel } from '../../models/ScreeningRun.model';
import { ScreeningResultModel } from '../../models/ScreeningResult.model';
import { SemanticCacheModel } from '../../models/SemanticCache.model';

export interface OrchestratorOptions {
	model?: string;
	topK?: number;
	weightConfig?: { skills: number; experience: number; education: number; relevance: number };
	useCache?: boolean;
}

export class ScreeningOrchestrator {
	private ai: GeminiAiService;

	constructor(apiKey: string, model = 'gemini-1.5-pro') {
		this.ai = new GeminiAiService(apiKey, { model });
	}

	async runForJob(jobId: string, triggeredBy: string, opts?: OrchestratorOptions) {
		const { job, applicants } = await getJobWithApplicants(jobId);
		if (!job) {
			throw new Error('Job not found');
		}

		const weight = WeightConfigSchema.partial().parse(opts?.weightConfig ?? { skills: 0.4, experience: 0.3, education: 0.1, relevance: 0.2 });
		const prompt = buildMultiCandidatePrompt({
			job,
			applicants,
			weightConfig: weight as any,
			topK: opts?.topK ?? job.screeningBatchSize ?? 20
		});

		// Cache key is a hash substitute using JSON stringify (for demo only)
		const cacheKey = Buffer.from(JSON.stringify({ jobId, applicants: applicants.map((a) => a.applicationId), weight })).toString('base64');

		let response: any | null = null;
		if (opts?.useCache !== false) {
			const cached = await SemanticCacheModel.findOne({ queryHash: cacheKey }).lean();
			if (cached) {
				response = JSON.parse(cached.responseText);
			}
		}

		const run = await ScreeningRunModel.create({
			job: job._id,
			triggeredBy,
			status: 'processing',
			batchSize: opts?.topK ?? job.screeningBatchSize ?? 20,
			totalCandidates: applicants.length,
			modelVersion: (this.ai as any).modelName ?? 'gemini-1.5-pro',
			startedAt: new Date()
		});

		try {
			if (!response) {
				response = await this.ai.evaluateWithPrompt(prompt);
			}
			const parsed = ModelOutputSchema.parse(response);

			// Persist results
			let rank = 1;
			for (const r of parsed.results.sort((a, b) => b.fitScore - a.fitScore)) {
				await ScreeningResultModel.create({
					screeningRun: run._id,
					application: r.applicationId,
					rankPosition: rank++,
					fitScore: r.fitScore,
					confidenceLevel: r.confidenceLevel,
					aiReasoning: r.aiReasoning,
					strengths: r.strengths,
					gaps: r.gaps,
					adjacentRoles: r.adjacentRoles,
					upskillingPaths: r.upskillingPaths,
					scoreBreakdown: r.scoreBreakdown as any,
					weightConfig: r.weightConfig as any
				} as any);
			}

			// Backfill cache
			if (opts?.useCache !== false) {
				await SemanticCacheModel.updateOne(
					{ queryHash: cacheKey },
					{
						$set: {
							queryText: prompt,
							responseText: JSON.stringify(parsed),
							modelVersion: (this.ai as any).modelName ?? 'gemini-1.5-pro',
							expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
						},
						$inc: { hitCount: 1 }
					},
					{ upsert: true }
				);
			}

			run.status = 'completed';
			run.completedAt = new Date();
			await run.save();
			return run;
		} catch (err: any) {
			run.status = 'failed';
			run.errorMessage = err?.message ?? 'Unknown error';
			run.completedAt = new Date();
			await run.save();
			throw err;
		}
	}

	// Manual mode: accept job and applicants directly (e.g., from CSV upload)
	async runManual(job: any, applicants: any[], triggeredBy: string, opts?: OrchestratorOptions) {
		const weight = WeightConfigSchema.partial().parse(opts?.weightConfig ?? { skills: 0.4, experience: 0.3, education: 0.1, relevance: 0.2 });
		const prompt = buildMultiCandidatePrompt({ job, applicants, weightConfig: weight as any, topK: opts?.topK ?? 20 });
		const response = await this.ai.evaluateWithPrompt(prompt);
		const parsed = ModelOutputSchema.parse(response);
		const run = await ScreeningRunModel.create({
			job: null,
			triggeredBy,
			status: 'completed',
			batchSize: opts?.topK ?? 20,
			totalCandidates: applicants.length,
			modelVersion: (this.ai as any).modelName ?? 'gemini-1.5-pro',
			startedAt: new Date(),
			completedAt: new Date()
		});
		let rank = 1;
		for (const r of parsed.results.sort((a, b) => b.fitScore - a.fitScore)) {
			await ScreeningResultModel.create({
				screeningRun: run._id,
				application: r.applicationId,
				rankPosition: rank++,
				fitScore: r.fitScore,
				confidenceLevel: r.confidenceLevel,
				aiReasoning: r.aiReasoning,
				strengths: r.strengths,
				gaps: r.gaps,
				adjacentRoles: r.adjacentRoles,
				upskillingPaths: r.upskillingPaths,
				scoreBreakdown: r.scoreBreakdown as any,
				weightConfig: r.weightConfig as any
			} as any);
		}
		return run;
	}
}

