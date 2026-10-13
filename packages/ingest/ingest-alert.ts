export type IngestAlertPayload = {
  source: string;
  status: 'error';
  error: string;
  ingestRunId: string | null;
  at: string;
};

/** Posts failed runs to the n8n alert webhook. Never throws: a broken alert must not mask the ingest error. */
export class IngestAlert {
  static readonly MAX_ERROR = 300;

  static redact(message: string, env: Record<string, string | undefined>): string {
    let out = message;
    for (const value of Object.values(env)) {
      // Short values (e.g. "1", "true") would shred the message without protecting anything.
      if (typeof value === 'string' && value.length >= 8) {
        out = out.split(value).join('[redacted]');
      }
    }
    return out.slice(0, IngestAlert.MAX_ERROR);
  }

  static runId(error: unknown): string | null {
    const id = (error as { ingestRunId?: unknown } | null)?.ingestRunId;
    return typeof id === 'string' ? id : null;
  }

  static payload(
    source: string,
    error: unknown,
    env: Record<string, string | undefined>,
    ingestRunId: string | null = IngestAlert.runId(error),
    now: Date = new Date(),
  ): IngestAlertPayload {
    const raw = error instanceof Error ? error.message : 'ingest failed';
    return { source, status: 'error', error: IngestAlert.redact(raw, env), ingestRunId, at: now.toISOString() };
  }

  /** Shared secret checked by the n8n Webhook node's Header Auth; omitted when unset. */
  static webhookHeaders(env: Record<string, string | undefined>): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (env.INGEST_ALERT_SECRET) {
      headers['x-fas-alert-secret'] = env.INGEST_ALERT_SECRET;
    }
    return headers;
  }

  static async notify(
    payload: IngestAlertPayload,
    env: Record<string, string | undefined> = process.env,
    httpFetch: typeof fetch = fetch,
  ): Promise<boolean> {
    const url = env.INGEST_ALERT_WEBHOOK_URL;
    if (!url) {
      return false;
    }
    try {
      const res = await httpFetch(url, {
        method: 'POST',
        headers: IngestAlert.webhookHeaders(env),
        body: JSON.stringify(payload),
      });
      if (res.ok && res.headers.get('cf-mitigated') !== 'challenge') {
        return true;
      }
    } catch {
      // fall through to the GitHub fallback
    }
    return IngestAlert.githubIssue(payload, env, httpFetch);
  }

  /** Fallback when n8n is unreachable: opens the same issue the n8n workflow would. */
  static async githubIssue(
    payload: IngestAlertPayload,
    env: Record<string, string | undefined>,
    httpFetch: typeof fetch,
  ): Promise<boolean> {
    const token = env.INGEST_ALERT_GITHUB_TOKEN;
    if (!token) {
      console.warn('ingest alert: n8n webhook failed and INGEST_ALERT_GITHUB_TOKEN is unset');
      return false;
    }
    const repo = env.INGEST_ALERT_GITHUB_REPO || 'aimogga/fas-caspilot-data';
    try {
      const res = await httpFetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: `Ingest failed: ${payload.source}`,
          body: `Source: ${payload.source}\nAt: ${payload.at}\nIngest run: ${payload.ingestRunId}\nError: ${payload.error}`,
          labels: ['ingest-alert'],
        }),
      });
      if (!res.ok) {
        console.warn(`ingest alert: GitHub issue fallback failed with HTTP ${res.status}`);
        return false;
      }
      const issue = (await res.json().catch(() => null)) as { number?: number } | null;
      console.info(`ingest-alert: opened issue #${issue?.number} for run ${payload.ingestRunId}`);
      return true;
    } catch {
      console.warn('ingest alert: GitHub issue fallback request failed');
      return false;
    }
  }
}
