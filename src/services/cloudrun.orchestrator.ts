import { ServicesClient } from '@google-cloud/run';
import { Storage } from '@google-cloud/storage';

let runClient: ServicesClient | null = null;
let storageClient: Storage | null = null;
const runnerUrlCache = new Map<string, string>();

function getRunClient() {
  if (!runClient) {
    runClient = new ServicesClient();
  }
  return runClient;
}

function getStorageClient() {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

export function isCloudRunRunnerEnabled(): boolean {
  return true;
}

/**
 * Gets an existing dedicated Cloud Run runner URL for a user tenant,
 * or provisions a new scale-to-zero container with dedicated GCS bucket FUSE mount.
 */
export async function getOrCreateTenantRunnerUrl(tenantId: string): Promise<string> {
  if (runnerUrlCache.has(tenantId)) {
    return runnerUrlCache.get(tenantId)!;
  }

  const projectId = process.env.GCP_PROJECT_ID || 'fabrica-production';
  const region = process.env.GCP_REGION || 'europe-west2';
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_\-]/g, '-').toLowerCase();
  
  // 1. Define dedicated GCS Bucket & Cloud Run Service name
  const tenantBucket = `fabrica-tenant-${safeTenant}`;
  const serviceName = `fabrica-runner-${safeTenant}`;
  const parent = `projects/${projectId}/locations/${region}`;
  const servicePath = `${parent}/services/${serviceName}`;

  // 2. Ensure Dedicated GCS Bucket Exists for User
  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(tenantBucket);
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log(`[Orchestrator] Creating dedicated GCS bucket for user: ${tenantBucket}...`);
      await storage.createBucket(tenantBucket, {
        location: region,
        uniformBucketLevelAccess: true
      });
    }
  } catch (err: any) {
    console.warn(`[Orchestrator] GCS Bucket check/creation warning: ${err.message}`);
  }

  // 3. Check if user container already exists
  try {
    const client = getRunClient();
    const [existingService] = await client.getService({ name: servicePath });
    if (existingService && existingService.uri) {
      runnerUrlCache.set(tenantId, existingService.uri);
      return existingService.uri;
    }
  } catch (err: any) {
    // Service not found; proceed to provision
  }

  console.log(`[Orchestrator] Provisioning dedicated Cloud Run container: ${serviceName}...`);

  // 4. Provision new scale-to-zero container for user mounting their dedicated bucket
  const runnerImage = process.env.RUNNER_CONTAINER_IMAGE || `gcr.io/${projectId}/fabrica-user-runner:latest`;
  try {
    const client = getRunClient();

    const [operation] = (await client.createService({
      parent,
      serviceId: serviceName,
      service: {
        template: {
          scaling: {
            minInstanceCount: 0,
            maxInstanceCount: 2
          },
          containers: [
            {
              image: runnerImage,
              resources: {
                limits: {
                  memory: '2Gi',
                  cpu: '1000m'
                }
              },
              volumeMounts: [
                {
                  name: 'tenant-gcs-mount',
                  mountPath: '/mnt'
                }
              ],
              env: [
                { name: 'TENANT_ID', value: tenantId },
                { name: 'WORKSPACES_STORAGE_PATH', value: '/mnt' },
                { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY || '' }
              ]
            }
          ],
          volumes: [
            {
              name: 'tenant-gcs-mount',
              gcs: {
                bucket: tenantBucket,
                readOnly: false
              }
            } as any
          ]
        }
      }
    })) as any;

    const [response] = await operation.promise();
    if (response && response.uri) {
      const uri = response.uri;
      runnerUrlCache.set(tenantId, uri);
      return uri;
    }
  } catch (err: any) {
    console.error(`[Orchestrator] Cloud Run provision error for tenant ${tenantId}: ${err.message}`);
    throw new Error(`Failed to provision dedicated Cloud Run runner container for tenant ${tenantId}: ${err.message}`);
  }

  throw new Error(`Dedicated Cloud Run runner container for tenant ${tenantId} failed to return a valid URL.`);
}

/**
 * Proxies an SSE stream turn request exclusively to a dedicated tenant runner container.
 */
export async function proxyTurnToRunnerStream(
  runnerUrl: string,
  payload: any,
  onChunk: (data: string) => void
): Promise<void> {
  const response = await fetch(`${runnerUrl}/api/runner/turn-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Runner container returned error status: ${response.status}`);
  }

  if (!response.body) return;

  const reader = (response.body as any).getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

/**
 * Proxies a synchronous turn request exclusively to a dedicated tenant runner container.
 */
export async function proxyTurnToRunner(runnerUrl: string, payload: any): Promise<any> {
  const response = await fetch(`${runnerUrl}/api/runner/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Runner container returned error status: ${response.status}`);
  }

  return await response.json();
}


