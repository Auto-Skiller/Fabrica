export interface PipelineJob {
  id: string;
  name: string;
  tenantId: string;
  type: 'sync' | 'simulation' | 'audit' | 'custom';
  status: 'queued' | 'running' | 'completed' | 'failed';
  queuedAt: string;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  logs: string[];
  execute: () => Promise<any>;
}

class PipelineOrchestrator {
  private queue: PipelineJob[] = [];
  private activeWorkers = 0;
  private maxConcurrency = 4;
  private activeJobs = new Map<string, PipelineJob>();
  private completedJobs: PipelineJob[] = [];

  constructor(maxConcurrency = 4) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Enqueues a new background job with strict tenant-level deduplication.
   * If a job of the same type for the same tenant is already queued or running,
   * the duplicate request is safely discarded or coalesced.
   */
  public enqueue(
    tenantId: string,
    type: PipelineJob['type'],
    name: string,
    execute: () => Promise<any>
  ): string {
    const jobKey = `${tenantId}:${type}`;

    // Deduplication: prevent stacking same background runs
    if (this.activeJobs.has(jobKey)) {
      const activeJob = this.activeJobs.get(jobKey)!;
      if (activeJob.status === 'queued' || activeJob.status === 'running') {
        activeJob.logs.push(`[Orchestrator] Coalesced duplicate trigger request received at ${new Date().toISOString()}`);
        return activeJob.id;
      }
    }

    const job: PipelineJob = {
      id: `job_${Math.random().toString(36).substring(2, 11)}`,
      name,
      tenantId,
      type,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      logs: [`[Orchestrator] Enqueued job: ${name} (type: ${type}) for tenant: "${tenantId}"`],
      execute
    };

    this.queue.push(job);
    this.activeJobs.set(jobKey, job);

    // Process queue asynchronously
    this.processQueue();

    return job.id;
  }

  /**
   * Process enqueued pipeline jobs up to max concurrency limit.
   */
  private async processQueue(): Promise<void> {
    if (this.activeWorkers >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    job.logs.push(`[Orchestrator] Workers active: ${this.activeWorkers}/${this.maxConcurrency}. Executing job...`);

    try {
      await job.execute();
      job.status = 'completed';
      job.logs.push(`[Orchestrator] Job completed successfully at ${new Date().toISOString()}`);
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message || String(err);
      job.logs.push(`[Orchestrator] Job execution failed: ${job.error}`);
    } finally {
      job.endedAt = new Date().toISOString();
      this.activeWorkers--;
      
      // Store in completed archive (limit to last 50 jobs for memory scaling)
      this.completedJobs.push(job);
      if (this.completedJobs.length > 50) {
        this.completedJobs.shift();
      }

      const jobKey = `${job.tenantId}:${job.type}`;
      this.activeJobs.delete(jobKey);

      // Trigger next batch
      this.processQueue();
    }
  }

  /**
   * Retrieves active, queued, and completed job statuses for real-time dashboards.
   */
  public getStatusReport() {
    const running = Array.from(this.activeJobs.values()).filter(j => j.status === 'running');
    const queued = this.queue;
    return {
      stats: {
        activeWorkers: this.activeWorkers,
        maxConcurrency: this.maxConcurrency,
        pendingJobsCount: queued.length,
        runningJobsCount: running.length,
        completedJobsCount: this.completedJobs.length,
      },
      activeJobs: running.map(j => ({
        id: j.id,
        name: j.name,
        tenantId: j.tenantId,
        type: j.type,
        queuedAt: j.queuedAt,
        startedAt: j.startedAt,
        logs: j.logs,
      })),
      queuedJobs: queued.map(j => ({
        id: j.id,
        name: j.name,
        tenantId: j.tenantId,
        type: j.type,
        queuedAt: j.queuedAt,
      })),
      recentCompleted: this.completedJobs.map(j => ({
        id: j.id,
        name: j.name,
        tenantId: j.tenantId,
        type: j.type,
        status: j.status,
        queuedAt: j.queuedAt,
        startedAt: j.startedAt,
        endedAt: j.endedAt,
        error: j.error,
        durationMs: j.startedAt && j.endedAt ? Date.now() - Date.parse(j.startedAt) : 0,
      })),
    };
  }
}

export const orchestrator = new PipelineOrchestrator(4);
