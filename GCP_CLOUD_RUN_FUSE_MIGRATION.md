# Migration Plan: Dedicated GCP Cloud Run Container + Dedicated GCS Bucket per User

## 💡 Architecture Blueprint: Dedicated Per-User Micro-Containers & Buckets

### "Where will user files and CLI binaries be executed and stored?"

1. **Dedicated User Cloud Run Containers (`fabrica-runner-<tenant_id>`)**:
   * Each user gets their own **isolated Cloud Run container instance** (`fabrica-runner-usr-123`).
   * **Scale-to-Zero ($0 Idle Cost)**: Every user's container scales to **0 active instances** when idle. Computing costs are strictly $0.00 when the user is not actively executing an agent mission.
   * **100% Hard Hardware & Process Isolation**: The Agent CLI process (`pi`) runs strictly inside the user's dedicated container instance. User A cannot view, inspect, or interact with User B's container, memory, CPU, or process space under any circumstance.

2. **Dedicated Cloud Storage (GCS) Bucket per User (`gs://fabrica-tenant-<tenant_id>/`)**:
   * Each user gets a **dedicated GCP Cloud Storage bucket** (`gs://fabrica-tenant-usr-123/`).
   * Mounted directly to `/mnt/workspace/` inside the user's dedicated Cloud Run container via Cloud Storage FUSE.
   * All workspace files (`workspace.json`, `harness.json`, `missions.json`, `workspace/`, `.pi/` skills, and `.npm-global/` CLI binary) persist infinitely in the user's dedicated GCS bucket.
   * The runner container accesses `/mnt/workspace/` as a real native filesystem with zero `subPath` multiplexing.

---

## 🗄️ Storage Architecture: Dedicated Bucket per User Strategy

### "Why Dedicated GCP Bucket per User?"

We have selected **Option B (Dedicated GCP Bucket per User)** to maximize security and GCP resource-level isolation:

* **100% Native GCP Resource Isolation**: Zero shared storage boundaries between users. User A's container only possesses IAM mount rights to `gs://fabrica-tenant-usr-aaaaa/` and physically cannot address or touch User B's bucket (`gs://fabrica-tenant-usr-bbbbb/`).
* **Clean Mount Setup**: Mounted cleanly directly at root `/mnt/workspace/` without relying on GCS prefix path translation (`subPath`).
* **Granular Per-User Billing & Analytics**: GCP Cost Explorer and GCS Inventory give exact storage and bandwidth metrics per tenant bucket.
* **Instant Offboarding / Wipe**: Deleting a user's entire dataset is a single non-destructive GCP call: `gcloud storage buckets delete gs://fabrica-tenant-usr-123 --recursive`.

---

## ⚡ Real-Time Storage Synchronization

### "Is everything in GCS and the container synced 24/7?"

**Yes, instantly and transparently via POSIX filesystem operations:**
* **Direct Mount (Not a background sync process)**: Cloud Storage FUSE translates file operations (`write`, `read`, `delete`, `mkdir`) directly into GCS Object Storage API calls in real-time.
* **Real-Time Consistency**: Whenever the Agent CLI (`pi`) creates or modifies a file in `/mnt/workspace/`, it is written **immediately** into the user's dedicated GCS bucket (`gs://fabrica-tenant-<tenant_id>/`).
* **Zero-Loss Scale-to-Zero**: When Cloud Run shuts down an idle container instance after 15 minutes, **100% of user workspace data, code files, and CLI configurations remain safe in their dedicated GCS bucket**. When the container wakes back up, `/mnt/workspace/` instantly mounts and reflects the latest GCS state.

---

## 💰 Cost Breakdown & GCP Free Tier Impact

### "Will having a dedicated Cloud Run container and GCS bucket per user cost money?"

**No, if configured with scale-to-zero (`min-instances = 0`).**

| Resource | GCP Free Tier Allowance (Every Month) | Cost Impact Per User Container |
| :--- | :--- | :--- |
| **Cloud Run Requests** | 2,000,000 requests / month | **$0.00** (Uses free request pool) |
| **Compute Memory** | 360,000 GB-seconds / month | **$0.00** when idle (`min-instances=0`) |
| **Compute CPU** | 180,000 vCPU-seconds / month | **$0.00** when idle (`min-instances=0`) |
| **Cloud Storage (GCS)** | 5 GB standard storage / month | **$0.02 / GB / month** beyond 5 GB |

### 🔑 Key Takeaways for Billing:
* **Idle Containers Cost $0**: A user who signs up and leaves their browser window closed incurs **$0.00 Cloud Run compute cost**.
* **Scale-to-Zero**: Cloud Run automatically spins down the user container after 15 minutes of inactivity.
* **On-Demand Warmup**: When the user sends a message or triggers an agent mission, Cloud Run boots their container in ~1.5–2 seconds.

---

## 🏗️ System Architecture & Interaction Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Central Gateway (Control Plane)                                │
│                                   Cloud Run: fabrica-gateway                                     │
│                                                                                                  │
│  - User Authentication & Auth Tokens (.stash/auth.json in GCS Control Bucket)                   │
│  - Web Application Dashboard Frontend (Next.js SPA)                                              │
│  - Cloud Run Orchestrator Service (Creates dedicated GCS bucket & boots runner container)        │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │ Proxy Requests / Internal Service Invocation   │
                        ▼                                                 ▼
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ User A Container (Cloud Run)                  │ │ User B Container (Cloud Run)                  │
│ Service Name: fabrica-runner-usr-aaaaa        │ │ Service Name: fabrica-runner-usr-bbbbb        │
│ Scale to 0 when idle                          │ │ Scale to 0 when idle                          │
│                                               │ │                                               │
│ ┌───────────────────────────────────────────┐ │ │ ┌───────────────────────────────────────────┐ │
│ │ Runner Express API & Agent CLI Process    │ │ │ │ Runner Express API & Agent CLI Process    │ │
│ └─────────────────────┬─────────────────────┘ │ │ └─────────────────────┬─────────────────────┘ │
│                       │                       │ │                       │                       │
│                       ▼ (GCS FUSE Mount)      │ │                       ▼ (GCS FUSE Mount)      │
│            /mnt/workspace/                    │ │            /mnt/workspace/                    │
└───────────────────────┼───────────────────────┘ └───────────────────────┼───────────────────────┘
                        │                                                 │
                        ▼                                                 ▼
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ Dedicated GCS Bucket:                         │ │ Dedicated GCS Bucket:                         │
│ gs://fabrica-tenant-usr-aaaaa/                │ │ gs://fabrica-tenant-usr-bbbbb/                │
│ (Directly mounted to User A /mnt/workspace)   │ │ (Directly mounted to User B /mnt/workspace)   │
└───────────────────────────────────────────────┘ └───────────────────────────────────────────────┘
```

---

## 🖥️ Dashboard UI & User Interaction Design

To ensure a seamless user experience, the Fabrica Next.js Dashboard (`frontend-next/app/dashboard/page.tsx`) preserves **100% of all existing dashboard UI components** (Tenant Switcher, Agent Chat, Workspace Selector, Missions Panel) while adding non-intrusive container diagnostics and a **new dedicated Right Panel**:

### 1. New Right Panel (Positioned to the Right of Missions & Workspace)
A brand-new collapsible inspection panel located on the right side of the dashboard layout featuring two main switchable tabs:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Fabrica Dashboard Layout                                  │
├───────────────────┬────────────────────────────────┬───────────────────────────────────┤
│ Left / Sidebar    │ Center Section                 │ NEW Right Panel                   │
│ (Existing UI)     │ (Existing UI)                  │ (Switchable Tabs)                 │
│                   │                                │                                   │
│ • Tenant Switcher │ • Agent Chat & Turn Feed       │ [ Live Preview ]  [ Files & Code ]│
│ • Mission List    │ • Active Mission Harness Controls │ ───────────────────────────────── │
│ • Workspace List  │ • Execution Logs               │ (Embedded iFrame or Interactive   │
│                   │                                │  GCS File Tree & Code Viewer)     │
└───────────────────┴────────────────────────────────┴───────────────────────────────────┘
```

#### 🌐 Tab A: Live Preview Panel (`<LiveAppPreview />`)
* **Embedded iFrame**: Renders `https://fabrica-runner-<tenant_id>.run.app` directly inside the dashboard.
* **Top Toolbar Controls**:
  * 🔄 **Reload iFrame**: Refreshes the web app preview without reloading the whole dashboard.
  * ↗️ **Open in New Tab**: Launches the app in a standalone browser window.
  * 📱 **Viewport Switcher**: Toggles between Mobile, Tablet, and Desktop responsive frame widths.
  * ⚡ **Container Status Pill**: Shows whether the user's runner container is **Warm (Active)** or **Waking Up (~1.8s)**.
* **Cold Start Mask**: If the container is scaled to 0, an overlay spinner appears over the iFrame stating: *"Waking up container `fabrica-runner-usr-123`..."* until the first HTTP ping succeeds.

#### 📁 Tab B: Files & Code Explorer (`<GcsFileExplorer />`)
* **GCS-Backed File Tree**:
  * Queries `/api/tenant/files` (which fetches directly from `gs://fabrica-tenant-<tenant_id>/` mounted at `/mnt/workspace/`).
  * Displays a full directory tree (`workspace.json`, `harness.json`, `missions/`, `.pi/` skills, user source code).
* **Instant Code Viewer**:
  * Clicking any file opens a high-contrast syntax-highlighted editor/viewer view.
  * Displays file size, last modified timestamp in GCS, and line count.
  * Includes a **Download File** and **Copy Content** quick action button.

---

### 2. Header Status Badge (`<ContainerStatusBadge />`)
* **Location**: Top Navigation Bar (next to Model Switcher & Profile).
* **Live Indicators**:
  * 🟢 **Active / Warm**: Container is booted and ready (`Instances: 1`).
  * 🟡 **Waking Up...**: Cold start triggered on prompt send (`~1.5s countdown loader`).
  * ⚪ **Idle (Scaled to 0)**: Container is sleeping at $0 idle cost (`Instances: 0`).
* **Interactive Drawer**: Clicking opens container resource metrics.

### 3. Tenant Settings Drawer: Dedicated Runner & Storage Panel (`<TenantContainerCard />`)
* **Location**: Fabrica Settings tab or Account Drawer.
* **Container Diagnostics**:
  * **Service Name**: `fabrica-runner-usr-123`
  * **Cloud Run Region**: `europe-west2`
  * **Compute Resources**: `1 vCPU / 2 GiB RAM`
  * **Dedicated GCS Bucket**: `gs://fabrica-tenant-usr-123/`
  * **Mount Location**: `/mnt/workspace/`
* **User Actions**:
  * **⚡ Manual Warmup / Pre-boot**: Pre-warms container before executing complex multi-file missions.
  * **🔄 Restart Container**: Hard reboots the runner container if a process or binary gets stuck.
  * **🧹 Purge Workspace**: Wipes files inside `gs://fabrica-tenant-usr-123/` while keeping tenant setup intact.
  * **📥 Export Workspace Backup**: Downloads a zipped bundle of workspace files directly from GCS.

### 4. Agent Execution Stream: Cold-Start Badge (`<AgentExecutionNotice />`)
* **Location**: Directly inside the Agent Chat / Execution Terminal feed.
* **Flow**:
  * When a user submits an agent mission while the container is scaled to 0, an inline badge appears:
    `⚡ Spinning up dedicated user container (fabrica-runner-usr-123)... (~1.8s cold start)`
  * Once `/api/runner/turn` responds, the badge turns green and streams execution logs in real time.

---

## 🛡️ Zero Feature Loss & Codebase Distribution

Every single module in the Fabrica codebase is divided cleanly between the **Control Plane Gateway** and the **Per-User Runner Containers**:

| Component / Module | Existing File | Target Execution Container | Role in Dedicated Container Architecture |
| :--- | :--- | :--- | :--- |
| **Authentication & Key Pools** | `src/core/auth.ts` | **Control Plane Gateway** | Manages user login, AES-256 encrypted BYOK keys, and user token tiers |
| **Container Orchestration** | `src/services/cloudrun.orchestrator.ts` *(New)* | **Control Plane Gateway** | Automatically provisions dedicated GCS bucket + boots `fabrica-runner-<tenant_id>` container |
| **Agent CLI Harness** | `src/core/harness.ts` | **Per-User Runner Container** | Spawns `@earendil-works/pi-coding-agent` binary locally inside the user container |
| **Workspace & Missions** | `src/core/workspace.ts`, `src/core/missions.ts` | **Per-User Runner Container** | Operates directly on `/mnt/workspace/` mounted via Cloud Storage FUSE |
| **Kernel Prompts & Skills** | `Fabrica_kernel/` | **Per-User Runner Container** | Bundled in container image (`/app/Fabrica_kernel/`) for local prompt assembly |
| **Entities Directory** | `src/utils.ts` | **Per-User Runner Container** | Resolves entities at `/mnt/workspace/entities/` |

---

## 📋 Step 1: GCP Infrastructure Setup

### 1.1 Provision Central System Control Bucket
```bash
# Bucket for Gateway system storage (.stash/auth.json)
gcloud storage buckets create gs://fabrica-system-control \
  --location=europe-west2 \
  --uniform-bucket-level-access
```

### 1.2 Enable Required GCP APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  storage.googleapis.com
```

### 1.3 Create Service Account & Grant Permissions for Gateway
```bash
# Create Service Account for Gateway Control Plane
gcloud iam service-accounts create fabrica-gateway-sa \
  --display-name="Fabrica Gateway Control Plane SA"

# Grant permission to create and invoke per-user Cloud Run instances
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:fabrica-gateway-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:fabrica-gateway-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Grant permission to create dedicated per-user GCS buckets on demand
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:fabrica-gateway-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

---

## 💻 Step 2: Codebase Implementation Details

### 2.1 Cloud Run Orchestrator Service (`src/services/cloudrun.orchestrator.ts`)
The Gateway server dynamically provisions the user's **dedicated GCS bucket** and **dedicated Cloud Run container** using the GCP Node SDK:

```typescript
import { ServicesClient } from '@google-cloud/run';
import { Storage } from '@google-cloud/storage';

const runClient = new ServicesClient();
const storage = new Storage();

export async function getOrCreateTenantRunnerUrl(tenantId: string): Promise<string> {
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
    console.error(`[Orchestrator] GCS Bucket check/creation warning: ${err.message}`);
  }

  // 3. Check if user container already exists
  try {
    const [existingService] = await runClient.getService({ name: servicePath });
    if (existingService && existingService.uri) {
      return existingService.uri;
    }
  } catch (err: any) {
    // 404 means container does not exist yet; proceed to provision
  }

  console.log(`[Orchestrator] Provisioning dedicated Cloud Run container: ${serviceName}...`);

  // 4. Provision new scale-to-zero container for user mounting their dedicated bucket
  const runnerImage = process.env.RUNNER_CONTAINER_IMAGE || `gcr.io/${projectId}/fabrica-user-runner:latest`;

  const [operation] = await runClient.createService({
    parent,
    serviceId: serviceName,
    service: {
      template: {
        scaling: {
          minInstanceCount: 0, // Scale to 0 when idle = $0 compute cost!
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
                mountPath: '/mnt/workspace' // Mounts user's dedicated bucket directly to workspace
              }
            ],
            env: [
              { name: 'TENANT_ID', value: tenantId },
              { name: 'WORKSPACES_STORAGE_PATH', value: '/mnt/workspace' }
            ]
          }
        ],
        volumes: [
          {
            name: 'tenant-gcs-mount',
            gcsVolumeSource: {
              bucket: tenantBucket, // Mounts user's dedicated GCS bucket
              readOnly: false
            }
          }
        ]
      }
    }
  });

  const [response] = await operation.promise();
  return response.uri!;
}
```

### 2.2 Control Plane Gateway Harness Proxy (`src/api/routes/harness.routes.ts`)
The Gateway proxies agent turn requests directly to the user's dedicated runner container:

```typescript
harnessRouter.post('/turn', async (req, res) => {
  try {
    const tenantId = req.user?.id || 'default_user';
    
    // Get or boot user's dedicated Cloud Run container URL
    const runnerUrl = await getOrCreateTenantRunnerUrl(tenantId);
    
    // Proxy request securely to user's dedicated container instance
    const response = await fetch(`${runnerUrl}/api/runner/turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_RUNNER_SECRET}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to execute turn on user container: ${err.message}` });
  }
});
```

### 2.3 Per-User Runner Container Entry Server (`src/runner/server.ts`)
Each user container executes the `@earendil-works/pi-coding-agent` binary locally inside `/mnt/workspace/`:

```typescript
import express from 'express';
import { runAgentCliTurn } from '../core/harness';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TENANT_ID = process.env.TENANT_ID || 'default_user';

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', tenantId: TENANT_ID }));

// Agent Turn Execution Handler (Runs inside dedicated user container)
app.post('/api/runner/turn', async (req, res) => {
  try {
    const workspaceRoot = '/mnt/workspace';
    const result = await runAgentCliTurn(TENANT_ID, workspaceRoot, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[User Runner Container] Dedicated runner active for tenant ${TENANT_ID} on port ${PORT}`);
});
```

---

## 🐳 Step 3: Container Build Setup

### 3.1 Gateway Dockerfile (`Dockerfile.gateway`)
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
COPY frontend-next/package*.json ./frontend-next/
RUN npm ci && cd frontend-next && npm ci
COPY . .
RUN npm run build:frontend
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### 3.2 Per-User Runner Container Dockerfile (`Dockerfile.runner`)
```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Pre-install agent CLI into container image for fast cold starts
RUN npm install -g @earendil-works/pi-coding-agent

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/runner/server.js"]
```

---

## 🚀 Step 4: Build & Deploy Strategy

### 4.1 Build and Push Docker Images to GCP Artifact Registry
```bash
# Build and push Gateway image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/fabrica-gateway:latest -f Dockerfile.gateway .

# Build and push Per-User Runner base image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/fabrica-user-runner:latest -f Dockerfile.runner .
```

### 4.2 Deploy Central Gateway Server
```bash
gcloud run deploy fabrica-gateway \
  --image gcr.io/YOUR_PROJECT_ID/fabrica-gateway:latest \
  --region europe-west2 \
  --service-account fabrica-gateway-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID,GCP_REGION=europe-west2,RUNNER_CONTAINER_IMAGE=gcr.io/YOUR_PROJECT_ID/fabrica-user-runner:latest
```

---

## 🧪 Step 5: Verification & Validation Playbook

1. **Dynamic Bucket & Container Provisioning Test**:
   - Register User A and send an agent prompt.
   - Verify that Gateway creates `gs://fabrica-tenant-usr-aaaaa/` and deploys `fabrica-runner-usr-aaaaa`.
2. **Scale-to-Zero Verification**:
   - Leave User A idle for 15 minutes.
   - Run `gcloud run services list` and confirm instance count drops to 0 ($0 compute cost).
3. **Hard Multi-Tenant Storage Isolation Verification**:
   - Confirm User A's container only mounts `gs://fabrica-tenant-usr-aaaaa/`.
   - Confirm User A has no IAM rights or visibility to User B's bucket (`gs://fabrica-tenant-usr-bbbbb/`).
4. **Persistent Workspace State**:
   - Save a workspace mission in User A's container.
   - Restart User A's container.
   - Verify all workspace files, `.pi/` skills, and session histories remain 100% persistent in User A's dedicated GCS bucket.
