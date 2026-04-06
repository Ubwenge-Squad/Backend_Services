import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

let configured = false;

function ensureConfigured(): void {
	if (configured) {
		return;
	}
	const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
	const apiKey = process.env.CLOUDINARY_API_KEY;
	const apiSecret = process.env.CLOUDINARY_API_SECRET;
	if (!cloudName || !apiKey || !apiSecret) {
		throw new Error('Cloudinary configuration is missing');
	}
	cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
	configured = true;
}

export async function uploadResumeBuffer(buffer: Buffer, fileName: string): Promise<UploadApiResponse> {
	ensureConfigured();
	return new Promise((resolve, reject) => {
		const uploader = cloudinary.uploader.upload_stream(
			{
				resource_type: 'raw',
				folder: 'intore/resumes',
				use_filename: true,
				unique_filename: true,
				filename_override: fileName
			},
			(error, result) => {
				if (error || !result) {
					reject(error ?? new Error('Failed to upload file to Cloudinary'));
					return;
				}
				resolve(result);
			}
		);
		uploader.end(buffer);
	});
}
