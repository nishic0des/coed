/**
 * Provider profile shapes are not fully typed by Auth.js.
 * Google sets `email_verified`; GitHub's Auth.js provider returns a verified
 * email when `user:email` is granted.
 */
export function isOAuthEmailVerified(
	provider: string,
	profile: unknown,
): boolean {
	if (!profile || typeof profile !== "object") return false;
	const p = profile as Record<string, unknown>;

	if (provider === "google") {
		return p.email_verified === true || p.verified_email === true;
	}

	if (provider === "github") {
		if (p.email_verified === true || p.verified === true) return true;
		return typeof p.email === "string" && p.email.length > 0;
	}

	return false;
}
