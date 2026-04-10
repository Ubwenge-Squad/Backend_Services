import { RankedOutputSchema, WeightConfigSchema } from './types';
import { buildMultiCandidatePrompt } from './prompts';
import { GeminiAiService } from './gemini';
import { getJobWithApplicants } from './retrievers/mongoRetriever';
import { ScreeningRunModel } from '../models/ScreeningRun.model';
import { ScreeningResultModel } from '../models/ScreeningResult.model';
import { SemanticCacheModel } from '../models/SemanticCache.model';
import { ScreeningSnapshotModel } from '../models/ScreeningSnapshot.model';

export interface OrchestratorOptions {
	model?: string;
	topK?: number;
	weightConfig?: { skills: number; experience: number; education: number; relevance: number };
	useCache?: boolean;
}

export class ScreeningOrchestrator {
	private ai: GeminiAiService;

	constructor(apiKey: string, model = 'gemini-2.5-flash') {
		this.ai = new GeminiAiService(apiKey, { model });
	}

	async runForJob(jobId: string, triggeredBy: string, opts?: OrchestratorOptions) {
		const { job, applicants } = await getJobWithApplicants(jobId);
		if (!job) {
			throw new Error('Job not found');
		}

		const weight = WeightConfigSchema.parse(opts?.weightConfig ?? { skills: 0.4, experience: 0.3, education: 0.1, relevance: 0.2 });
		const prompt = buildMultiCandidatePrompt({
			job,
			applicants,
			weightConfig: weight,
			topK: opts?.topK ?? job.screeningBatchSize ?? 20
		});

		// Cache key is a hash substitute using JSON stringify (for demo only)
		const cacheKey = Buffer.from(JSON.stringify({ jobId, applicants: applicants.map((a) => a.applicationId), weight })).toString('base64');

		let response: unknown | null = null;
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
			modelVersion: 'gemini-2.5-flash',
			startedAt: new Date()
		});

		try {
			if (!response) {
				response = await this.ai.evaluateWithPrompt(prompt);
			}
			const parsed = RankedOutputSchema.parse(response);

			// Persist results
			const sorted = [...parsed].sort((a, b) => a.rank - b.rank);
			for (const r of sorted) {
				const applicationId = r.applicationId || applicants.find((a) => a.normalized?.name === r.name)?.applicationId;
				if (!applicationId) continue;
				await ScreeningResultModel.create({
					screeningRun: run._id,
					application: applicationId,
					candidateName: r.name,
					rankPosition: r.rank,
					fitScore: r.score,
					confidenceLevel: r.score >= 75 ? 'high' : r.score >= 50 ? 'medium' : 'low',
					aiReasoning: r.reason,
					recommendation: r.recommendation,
					strengths: r.strengths,
					gaps: r.gaps,
					weightConfig: weight as unknown as Record<string, number>
				});
			}

			// Save latest snapshot per job to avoid recompute/read complexity
			await ScreeningSnapshotModel.updateOne(
				{ jobId: job._id },
				{
					$set: {
						jobId: job._id,
						screeningRun: run._id,
						results: sorted
					}
				},
				{ upsert: true }
			);

			// Backfill cache
			if (opts?.useCache !== false) {
				await SemanticCacheModel.updateOne(
					{ queryHash: cacheKey },
					{
						$set: {
							queryText: prompt,
							responseText: JSON.stringify(parsed),
							modelVersion: 'gemini-2.5-flash',
							expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
						},
						$inc: { hitCount: 1 }
					},
					{ upsert: true }
				);
			}

			run.status = 'completed';
			run.completedAt = new Date();
			run.processedCount = applicants.length;
			await run.save();
			return { run, results: sorted };
		} catch (err: any) {
			console.error('Orchestrator error:', err);
			run.status = 'failed';
			run.errorMessage = err?.message ?? 'Unknown error';
			run.completedAt = new Date();
			await run.save();
			throw err;
		}
	}
}

