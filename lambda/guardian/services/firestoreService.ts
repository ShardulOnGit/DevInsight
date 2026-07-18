/**
 * @file lambda/guardian/services/firestoreService.ts
 * @description Firebase Admin SDK integration — all Firestore I/O for the Lambda.
 *
 * Design principles:
 *   - Single initialization per Lambda execution environment (singleton pattern).
 *   - All writes are batched where Firestore limits allow (max 500 ops/batch).
 *   - Every method returns Result<T> — callers handle failures explicitly.
 *   - Interfaces defined first for dependency injection and testability.
 *
 * Collections accessed:
 *   - /users/{uid}                  — read: active user roster
 *   - /dailyActivities/{uid_date}   — batch write: GitHub activity records
 *   - /insights/{auto-id}           — write: AI-generated coaching insights
 *   - /reports/{auto-id}            — write: weekly performance reports
 *   - /agentMemory/{uid}            — read + write: agent memory documents
 *   - /guardianRuns/{runId}         — write: audit log of each Lambda run
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  type Firestore,
  type WriteBatch,
} from 'firebase-admin/firestore';
import type { FirebaseServiceAccount, UserRecord } from '../types.ts';
import type {
  AgentMemory,
  DailyActivity,
  GuardianRun,
  InsightData,
  ReportData,
} from '../../../shared/types.ts';
import type { ILogger } from '../utils/logger.ts';
import type { Result } from '../utils/result.ts';
import { ok, err, tryAsync } from '../utils/result.ts';

// ─── Service Interface (for dependency injection) ─────────────────────────────

export interface IFirestoreService {
  /** Returns all users with a connected GitHub account. */
  getActiveUsers(): Promise<Result<UserRecord[]>>;

  /** Returns the agent memory doc for a user, or null if this is their first run. */
  getAgentMemory(uid: string): Promise<Result<AgentMemory | null>>;

  /**
   * Batch-writes all activity documents for a user.
   * Uses Firestore WriteBatch for atomic, low-latency writes.
   */
  batchWriteActivities(
    uid: string,
    activities: DailyActivity[],
  ): Promise<Result<void>>;

  /**
   * Writes AI-generated insight documents.
   * Each insight is a separate document with a server-generated ID.
   */
  writeInsights(
    uid: string,
    insights: ReadonlyArray<Omit<InsightData, 'uid' | 'createdAt'>>,
  ): Promise<Result<void>>;

  /** Writes a single weekly performance report document. */
  writeReport(uid: string, report: Omit<ReportData, 'uid' | 'timestamp'>): Promise<Result<void>>;

  /** Upserts the agent memory document for a user. */
  updateAgentMemory(
    uid: string,
    memory: Omit<AgentMemory, 'updatedAt'>,
  ): Promise<Result<void>>;

  /** Writes the Guardian run audit log. Called once per Lambda invocation. */
  writeGuardianRun(run: GuardianRun): Promise<Result<void>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTIONS = {
  users: 'users',
  activities: 'dailyActivities',
  insights: 'insights',
  reports: 'reports',
  memory: 'agentMemory',
  runs: 'guardianRuns',
} as const;

/**
 * Firestore batch limit. We stay below 500 to leave headroom.
 * At 14 activities/user this limit will never be reached at this scale.
 */
const MAX_BATCH_SIZE = 400;

// ─── Singleton Initialization ─────────────────────────────────────────────────

let _db: Firestore | null = null;

function getDb(serviceAccount: FirebaseServiceAccount): Firestore {
  if (_db !== null) return _db;

  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }

  _db = getFirestore();
  // Use high-throughput settings appropriate for Lambda burst workloads
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

// ─── Implementation ───────────────────────────────────────────────────────────

class FirestoreService implements IFirestoreService {
  private readonly db: Firestore;

  constructor(
    serviceAccount: FirebaseServiceAccount,
    private readonly logger: ILogger,
  ) {
    this.db = getDb(serviceAccount);
  }

  async getActiveUsers(): Promise<Result<UserRecord[]>> {
    return tryAsync(async () => {
      // Inequality query: only documents where githubUsername is a non-empty string.
      // Firestore excludes documents where the field is absent or null.
      const snapshot = await this.db
        .collection(COLLECTIONS.users)
        .where('githubUsername', '!=', '')
        .get();

      const users: UserRecord[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Validate required fields before including the user
        if (
          typeof data['uid'] === 'string' &&
          typeof data['email'] === 'string' &&
          typeof data['githubUsername'] === 'string' &&
          data['email'].includes('@')
        ) {
          const user: UserRecord = {
            uid: data['uid'] as string,
            email: data['email'] as string,
            displayName: typeof data['displayName'] === 'string' ? data['displayName'] : 'Developer',
            githubUsername: data['githubUsername'] as string,
            ...(typeof data['githubAccessToken'] === 'string' && data['githubAccessToken']
              ? { githubAccessToken: data['githubAccessToken'] as string }
              : {}),
          };
          users.push(user);
        } else {
          this.logger.warn('OBSERVE', {
            event: 'SKIPPED_INVALID_USER',
            docId: doc.id,
            reason: 'Missing required fields (uid, email, or githubUsername)',
          });
        }
      }

      return users;
    }, 'FirestoreService.getActiveUsers');
  }

  async getAgentMemory(uid: string): Promise<Result<AgentMemory | null>> {
    return tryAsync(async () => {
      const snap = await this.db
        .collection(COLLECTIONS.memory)
        .doc(uid)
        .get();

      if (!snap.exists) return null;
      return snap.data() as AgentMemory;
    }, `FirestoreService.getAgentMemory:${uid}`);
  }

  async batchWriteActivities(
    uid: string,
    activities: DailyActivity[],
  ): Promise<Result<void>> {
    return tryAsync(async () => {
      // Chunk into batches to respect Firestore's 500-op limit
      const chunks = chunkArray(activities, MAX_BATCH_SIZE);

      for (const chunk of chunks) {
        const batch: WriteBatch = this.db.batch();
        for (const activity of chunk) {
          const docId = `${uid}_${activity.date}`;
          const ref = this.db.collection(COLLECTIONS.activities).doc(docId);
          batch.set(
            ref,
            { ...activity, uid, timestamp: FieldValue.serverTimestamp() },
            { merge: true },
          );
        }
        await batch.commit();
      }
    }, `FirestoreService.batchWriteActivities:${uid}`);
  }

  async writeInsights(
    uid: string,
    insights: ReadonlyArray<Omit<InsightData, 'uid' | 'createdAt'>>,
  ): Promise<Result<void>> {
    return tryAsync(async () => {
      // Batch all insight writes into a single Firestore batch
      const batch: WriteBatch = this.db.batch();
      for (const insight of insights) {
        const ref = this.db.collection(COLLECTIONS.insights).doc();
        batch.set(ref, { uid, ...insight, createdAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
    }, `FirestoreService.writeInsights:${uid}`);
  }

  async writeReport(
    uid: string,
    report: Omit<ReportData, 'uid' | 'timestamp'>,
  ): Promise<Result<void>> {
    return tryAsync(async () => {
      const ref = this.db.collection(COLLECTIONS.reports).doc();
      await ref.set({ uid, ...report, timestamp: FieldValue.serverTimestamp() });
    }, `FirestoreService.writeReport:${uid}`);
  }

  async updateAgentMemory(
    uid: string,
    memory: Omit<AgentMemory, 'updatedAt'>,
  ): Promise<Result<void>> {
    return tryAsync(async () => {
      const ref = this.db.collection(COLLECTIONS.memory).doc(uid);
      await ref.set(
        { ...memory, updatedAt: FieldValue.serverTimestamp() },
        { merge: false }, // full overwrite — memory is replaced, not merged
      );
    }, `FirestoreService.updateAgentMemory:${uid}`);
  }

  async writeGuardianRun(run: GuardianRun): Promise<Result<void>> {
    return tryAsync(async () => {
      const ref = this.db.collection(COLLECTIONS.runs).doc(run.runId);
      await ref.set(run);
    }, `FirestoreService.writeGuardianRun:${run.runId}`);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a FirestoreService instance with the given service account.
 * Reuses the initialized Firebase app across warm invocations.
 */
export function createFirestoreService(
  serviceAccount: FirebaseServiceAccount,
  logger: ILogger,
): IFirestoreService {
  return new FirestoreService(serviceAccount, logger);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Invalidates the Firestore singleton for tests. */
export function _clearFirestoreSingleton(): void {
  _db = null;
}
