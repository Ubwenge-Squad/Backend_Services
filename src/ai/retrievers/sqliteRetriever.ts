// Optional SQLite retriever. Only used if explicitly enabled and dependency present.
// This is a stub to illustrate plug-in architecture.
export async function getJobWithApplicantsSqlite(_jobId: string) {
	throw new Error('SQLite retriever not configured. Set USE_SQLITE=true and implement adapter.');
}

