# Migration Plan: GCP Cloud Run + Cloud Storage FUSE (Per-Tenant Dedicated CLI Binary & Storage)

## 💡 Non-Technical Explanation: Where Will Things Live?

### "Where will the files and CLI binaries be stored?"
1. **Google Cloud Storage (GCS) Bucket** (`gs://fabrica-tenant-workspaces/`):
   * All user files (`workspace.json`, `harness.json`, `missions/`, `.pi/` skills) and each user's **dedicated Agent CLI binary** (`.npm-global/bin/pi`) will be stored in Google Cloud's secure, infinite cloud storage.
   * **They do NOT take up permanent disk space or memory on the web server itself.**
   * This means if 1,000 users sign up, your web server never runs out of disk space or crashes.

---

### "What does 'mounted virtually to the server' mean?"
Think of **Google Cloud Storage FUSE** like plugging a **virtual USB flash drive** over the internet into your server:
* When your Cloud Run web server starts up, it creates a virtual folder shortcut called `/mnt/workspaces/`.
* When **User A** logs in, the server opens `/mnt/workspaces/user_a/`. Behind the scenes, Cloud Storage FUSE streams user_a's files and binary from Cloud Storage into that virtual folder instantly.
* To the Agent CLI process, `/mnt/workspaces/user_a/` **looks and behaves exactly like a real, local folder on the hard drive**.
* When the Agent CLI makes a live edit (e.g., updates code or creates a file), the edit happens instantly in `/mnt/workspaces/user_a/` and is automatically saved back to Cloud Storage in real time.
* If **User A** closes their browser and comes back 3 weeks later (even if the server restarted 100 times in between), their dedicated Agent CLI binary, installed npm packages, and workspace files are loaded right back into `/mnt/workspaces/user_a/`.

---

## 🛡️ Zero Feature Loss & Adaptation Strategy

To ensure **100% feature preservation** and **zero downtime or broken functionality**, the migration preserves and adapts every single existing Fabrica feature:

| Existing Feature | Current Behavior | Adapted Behavior in New Architecture |
| :--- | :--- | :--- |
| **Tenant Initialization (`POST /api/tenant/initialize`)** | Creates local `workspaces/<tenant_id>/` folder | Creates `/mnt/workspaces/<tenant_id>/` in GCS FUSE mount & provisions user's **own dedicated CLI binary** |
| **Agent CLI Execution (`src/core/harness.ts`)** | Runs shared server binary `pi` | Runs the user's **dedicated binary** at `/mnt/workspaces/<tenant_id>/.npm-global/bin/pi` |
| **Workspace Configuration (`workspace.json`, `tenant.json`, `harness.json`)** | Saved on local disk | Saved in `/mnt/workspaces/<tenant_id>/` (instantly synced to GCS) |
| **Agent Workspace Skills (`.pi/` directory)** | Stored locally | Stored inside `/mnt/workspaces/<tenant_id>/.pi/` (100% persistent) |
| **Missions & Logs (`missions.json`, `user_logs.json`)** | Saved locally | Saved inside `/mnt/workspaces/<tenant_id>/` |

---

## 🏗️ Architectural Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          Google Cloud Run Service                                       │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         Fabrica Node.js Server                                  │   │
│   │                                                                                 │   │
│   │   tenant.ts ──> getTenantRoot(tenantId)                                         │   │
│   │                    │                                                            │   │
│   │                    ▼                                                            │   │
│   │          /mnt/workspaces/<tenant_id>/                                           │   │
│   │          ├── workspace.json                                                     │   │
│   │          ├── harness.json                                                       │   │
│   │          ├── missions/                                                          │   │
│   │          ├── .pi/ (Dedicated User Agent Skills & Directives)                    │   │
│   │          └── .npm-global/                                                       │   │
│   │              └── bin/                                                           │   │
│   │                  └── pi (DEDICATED PER-TENANT AGENT CLI BINARY)                 │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                                    │
│                                    │ (Cloud Storage FUSE Virtual Mount)                 │
│                                    ▼                                                    │
│        ┌──────────────────────────────────────────────────────┐                         │
│        │   GCP Bucket: gs://fabrica-tenant-workspaces/       │                         │
│        └──────────────────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step 1: Infrastructure Setup

### 1.1 Create GCS Storage Bucket
Provision a dedicated Google Cloud Storage bucket in your GCP region:
```bash
gcloud storage buckets create gs://fabrica-tenant-workspaces \
  --location=europe-west2 \
  --uniform-bucket-level-access
```

### 1.2 Assign IAM Permissions
Grant the Cloud Run Service Account object administration rights:
```bash
gcloud storage buckets add-iam-policy-binding gs://fabrica-tenant-workspaces \
  --member="serviceAccount:YOUR_CLOUD_RUN_SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### 1.3 Add Environment Variables
Update `.env.example` to declare the storage mount path:
```env
# Storage Mount Directory (Defaults to local ./workspaces for dev, /mnt/workspaces for Cloud Run)
WORKSPACES_STORAGE_PATH=/mnt/workspaces
```

---

## 💻 Step 2: Codebase Adaptation

### 2.1 `getTenantRoot` in `src/core/tenant.ts`
Update `src/core/tenant.ts` to resolve the tenant's workspace root directly in the Cloud Storage FUSE mount path `/mnt/workspaces/<tenant_id>`:

```typescript
export function getTenantRoot(tenantId: string): string {
  const safeTenant = (tenantId || 'usr_anon').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const baseStorageDir = path.resolve(process.env.WORKSPACES_STORAGE_PATH || '/mnt/workspaces');

  const userRoot = path.join(baseStorageDir, safeTenant);
  if (!fs.existsSync(userRoot)) {
    fs.mkdirSync(userRoot, { recursive: true });
  }

  return userRoot;
}
```

### 2.2 Provision Per-User Dedicated Agent CLI Binary on Tenant Initialization
In `src/core/tenant.ts`, ensure that every tenant gets their own dedicated `@earendil-works/pi-coding-agent` binary installed in their persistent directory:

```typescript
export function ensureTenantAgentCliBinary(tenantId: string): string {
  const userRoot = getTenantRoot(tenantId);
  const globalNpmDir = path.join(userRoot, '.npm-global');
  const tenantBinaryPath = path.join(globalNpmDir, 'bin', 'pi');

  if (!fs.existsSync(tenantBinaryPath)) {
    console.log(`[Tenant ${tenantId}] Installing dedicated Agent CLI binary into ${globalNpmDir}...`);
    try {
      execSync(`npm install -g --prefix "${globalNpmDir}" --ignore-scripts @earendil-works/pi-coding-agent`, {
        env: { ...process.env, NPM_CONFIG_PREFIX: globalNpmDir },
        stdio: 'inherit'
      });
    } catch (err) {
      console.error(`[Tenant ${tenantId}] Error installing dedicated agent binary:`, err);
    }
  }

  return tenantBinaryPath;
}
```

### 2.3 Execute Per-Tenant Dedicated Binary in `src/core/harness.ts`
When running agent commands or CLI tasks, execute the user's **dedicated CLI binary**:

```typescript
const tenantRoot = getTenantRoot(tenantId);
const globalNpmDir = path.join(tenantRoot, '.npm-global');
const tenantBinaryPath = path.join(globalNpmDir, 'bin', 'pi');

// Use tenant's own binary if present, else fall back to provisioned binary
const binaryToRun = fs.existsSync(tenantBinaryPath) ? tenantBinaryPath : 'pi';

const agentProcess = spawn(binaryToRun, args, {
  cwd: tenantRoot,
  env: {
    ...process.env,
    NPM_CONFIG_PREFIX: globalNpmDir,
    PATH: `${path.join(globalNpmDir, 'bin')}:${process.env.PATH}`
  }
});
```

---

## 🚀 Step 3: Cloud Run Deployment

Deploy the application to Cloud Run with the mounted GCS bucket:

```bash
gcloud run deploy fabrica-app \
  --image gcr.io/YOUR_PROJECT_ID/fabrica:latest \
  --region europe-west2 \
  --execution-environment gen2 \
  --add-volume name=workspaces-volume,type=cloud-storage,bucket=fabrica-tenant-workspaces \
  --add-volume-mount volume=workspaces-volume,mount-path=/mnt/workspaces \
  --set-env-vars WORKSPACES_STORAGE_PATH=/mnt/workspaces
```

---

## 🧪 Step 4: Verification & Validation

1. **Dedicated Binary Provisioning Test**:
   - Register a new user on the deployed app.
   - Verify `POST /api/tenant/initialize` installs the dedicated CLI binary into `/mnt/workspaces/<tenant_id>/.npm-global/bin/pi`.
2. **Binary Isolation & Persistence Verification**:
   - Verify that running agent tasks uses `/mnt/workspaces/<tenant_id>/.npm-global/bin/pi`.
   - Update or customize the CLI binary for Tenant A (or install a custom plugin). Verify Tenant B's binary remains entirely unaffected.
   - Restart the Cloud Run container instance and verify the tenant's installed binary and workspace files remain 100% intact.
3. **Real-Time Live Editing**:
   - Trigger an agent turn and monitor live file system modifications performed by the tenant's dedicated CLI binary.


