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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
