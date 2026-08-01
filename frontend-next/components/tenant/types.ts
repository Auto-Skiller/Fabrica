import { RuntimeYaml } from '../harness/types';
import { MissionsYaml } from '../missions/types';
import { ToolboxesYaml, InboxYaml, PromptsYaml } from '../workspace/types';

export interface EntityData {
  board: string;
  runtime: RuntimeYaml;
  missions: MissionsYaml;
  toolboxes: ToolboxesYaml;
  inbox: InboxYaml;
  prompts: PromptsYaml;
}

export interface EcosystemEntity {
  name: string;
  missions: number;
  toolboxes_total: number;
  toolboxes_active: number;
  pillars: number;
  evolution: number;
  review_queue: number;
  backlog: number;
  inbox_raw: number;
  gateway: number;
  prompts: number;
}

export interface EcosystemData {
  entities: EcosystemEntity[];
  totals: {
    entities: number;
    missions: number;
    toolboxes_active: number;
    inbox_raw: number;
  };
}

export interface ConfigYaml {
  current_window: string;
  autonomy?: boolean;
  dashboard?: {
    theme: string;
  };
}

export interface TenantProfile {
  tenantId: string;
  name?: string;
  email?: string;
  plan?: string;
  ecosystem?: EcosystemData;
  projects?: any[];
  board?: string;
  context?: Record<string, any>;
  telemetry?: Record<string, any>;
  last_active?: string;
}
