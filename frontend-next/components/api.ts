import { authApi } from './auth/api';
import { tenantApi } from './tenant/api';
import { harnessApi } from './harness/api';
import { missionsApi } from './missions/api';
import { workspaceApi } from './workspace/api';

export const api = {
  ...authApi,
  ...tenantApi,
  ...harnessApi,
  ...missionsApi,
  ...workspaceApi,
};

export { authApi, tenantApi, harnessApi, missionsApi, workspaceApi };
