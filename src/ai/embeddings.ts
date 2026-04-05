import { GoogleGenerativeAI } from '@google/generative-ai';

export class EmbeddingsService {
	private genAI: GoogleGenerativeAI;
	private model: string;

	constructor(apiKey: string, model = 'text-embedding-004') {
		this.genAI = new GoogleGenerativeAI(apiKey);
		this.model = model;
	}

	// Placeholder: depends on embeddings API surface
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async embed(texts: string[]): Promise<number[][]> {
		// TODO: implement using embeddings model when available in SDK
		return texts.map(() => []);
	}
}

