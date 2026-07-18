/**
 * @file lambda/guardian/services/githubService.ts
 * @description GitHub Events API integration — fetches user activity events.
 *
 * Design principles:
 *   - Returns Result<GitHubEvent[]>: callers decide whether to fall back to simulated data.
 *   - Classifies errors precisely: rate limits are a distinct failure mode from network errors.
 *   - Includes X-RateLimit headers in the error for CloudWatch dashboards.
 *   - Uses a consistent User-Agent header to identify DevInsight in GitHub's logs.
 */

import type { GitHubEvent } from '../../../shared/types.ts';
import type { Result } from '../utils/result.ts';
import { ok, err } from '../utils/result.ts';

// ─── Custom Error Types ───────────────────────────────────────────────────────

export class GitHubRateLimitError extends Error {
  constructor(
    public readonly resetTimestamp: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

// ─── Service Interface ────────────────────────────────────────────────────────

export interface IGitHubService {
  /**
   * Fetches the most recent public (or authenticated) events for a GitHub user.
   * Returns:
   *   - ok(events)                on success
   *   - err(GitHubRateLimitError) when rate-limited (caller should use simulated data)
   *   - err(GitHubApiError)       on any other non-2xx response
   *   - err(Error)                on network failure
   */
  fetchEvents(
    username: string,
    accessToken?: string,
  ): Promise<Result<GitHubEvent[]>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com';
const USER_AGENT = 'DevInsight-Guardian/1.0 (https://github.com/devinsight)';

// ─── Implementation ───────────────────────────────────────────────────────────

class GitHubService implements IGitHubService {
  async fetchEvents(
    username: string,
    accessToken?: string,
  ): Promise<Result<GitHubEvent[]>> {
    const endpoint = accessToken
      ? `${GITHUB_API_BASE}/users/${username}/events`
      : `${GITHUB_API_BASE}/users/${username}/events/public`;

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github.v3+json',
    };

    if (accessToken) {
      headers['Authorization'] = `token ${accessToken}`;
    }

    let response: Response;

    try {
      response = await fetch(endpoint, { headers });
    } catch (networkError: unknown) {
      const message =
        networkError instanceof Error ? networkError.message : String(networkError);
      return err(new Error(`GitHub network error for '${username}': ${message}`));
    }

    // ── Rate limit handling ──────────────────────────────────────────────────
    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get('X-RateLimit-Reset');
      const resetTimestamp = resetHeader ? parseInt(resetHeader, 10) : null;
      const resetReadable = resetTimestamp
        ? new Date(resetTimestamp * 1000).toISOString()
        : 'unknown';

      return err(
        new GitHubRateLimitError(
          resetTimestamp,
          `GitHub rate limit exceeded for '${username}'. Resets at ${resetReadable}.`,
        ),
      );
    }

    // ── Other HTTP errors ─────────────────────────────────────────────────────
    if (!response.ok) {
      return err(
        new GitHubApiError(
          response.status,
          `GitHub API returned ${response.status} for user '${username}'`,
        ),
      );
    }

    // ── Parse response ────────────────────────────────────────────────────────
    try {
      const events = (await response.json()) as GitHubEvent[];
      return ok(events);
    } catch {
      return err(new Error(`Failed to parse GitHub events JSON for '${username}'`));
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGitHubService(): IGitHubService {
  return new GitHubService();
}
