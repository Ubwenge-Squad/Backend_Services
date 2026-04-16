import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildMultiCandidatePrompt } from './prompts';

export interface ScreeningPromptConfig {
	model: string;
	maxCandidatesPerBatch: number;
}

export class GeminiAiService {
	private genAI: GoogleGenerativeAI;
	private modelName: string;

	constructor(apiKey: string, config?: Partial<ScreeningPromptConfig>) {
		this.genAI = new GoogleGenerativeAI(apiKey);
		this.modelName = config?.model || 'gemini-2.5-flash';
	}

	// Convenience: build prompt internally with defaults
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async evaluateCandidates(job: unknown, candidates: unknown[]): Promise<unknown> {
		const prompt = buildMultiCandidatePrompt({ job, applicants: candidates, topK: 20 });
		return await this.evaluateWithPrompt(prompt);
	}

	async evaluateWithPrompt(prompt: string): Promise<unknown> {
		const model = this.genAI.getGenerativeModel({ 
			model: this.modelName, 
			generationConfig: { responseMimeType: 'application/json' } 
		});
		const result = await model.generateContent(prompt);
		const text = result.response.text();
		const json = this.extractJson(text);
		return json;
	}

	async answerWithPrompt(prompt: string): Promise<string> {
		const model = this.genAI.getGenerativeModel({ 
			model: this.modelName, 
			generationConfig: { responseMimeType: 'application/json' } 
		});
		const result = await model.generateContent(prompt);
		return result.response.text();
	}

	async streamContent(prompt: string) {
		const model = this.genAI.getGenerativeModel({ model: this.modelName });
		const result = await model.generateContentStream(prompt);
		return result.stream;
	}

	private extractJson(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch (_) {}

  // Try fenced code block
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
  if (fence?.[1]) {
    try { return JSON.parse(fence[1]); } catch (_) {}
  }

  // Try array first [ ... ]
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(text.slice(arrStart, arrEnd + 1)); } catch (_) {}
  }

  // Fallback to object { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) {}
  }

  throw new Error('Failed to parse model JSON output');
}
}

