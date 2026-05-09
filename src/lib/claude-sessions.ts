// Shared store for active Claude login PTY sessions.
// Allows the submit-code route to write the OAuth code back to the PTY process.
export const claudeLoginSessions = new Map<string, (s: string) => void>();
