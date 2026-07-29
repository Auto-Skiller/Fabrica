export type MissionClass = 'DRAFT' | 'PLANNING' | 'EXECUTION' | 'DONE';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PillarSuggestion {
  status: boolean;
  description: string;
  why: string;
  contains: string[];
  triggers?: string[];
  relevant_paths?: string[];
}

export interface EvolutionObjective {
  status: boolean;
  description: string;
  objective: string;
}

export interface FillQueue {
  os_prompts?: number;
  data?: number;
  missions?: number;
  toolboxes?: number;
  inbox?: {
    raw: number;
    analysing: number;
    gateway: number;
    discovery?: string[];
    raw_items?: Record<string, any>[];
    analysing_items?: Record<string, any>[];
  };
  runtime?: {
    pillars: number;
    evolution_objectives: number;
  };
}

export interface RuntimeYaml {
  freshness: {
    last_edited: string | null;
    last_synced: string;
    sync_count: number;
    sync_status: string;
  };
  metrics: {
    review_queue: number;
    backlog: number;
    pillars: {
      actives: number;
      validated: number;
      suggestions: number;
    };
    evolution_objectives?: {
      actives: number;
      validated: number;
      suggestions: number;
    };
    fill_queue?: Record<string, any>;
  };
  review_queue: string[];
  backlog: string[];
  pillars: {
    actives: string[];
    suggestions: Record<string, PillarSuggestion>;
    validated: {
      active: number;
      total: number;
    };
  };
  evolution_objectives: {
    actives: string[];
    suggestions: Record<string, EvolutionObjective>;
    validated?: {
      active: number;
      total: number;
    };
  };
  fill_queue: FillQueue;
  recent_events: string[];
}

export interface MissionGoal {
  status: boolean;
  priority: Priority;
  goal: string;
  why: string;
  cause: string;
  how: string;
  benefits: string[];
  benefits_value: 'HIGH' | 'MEDIUM' | 'LOW';
  costs: string[];
  costs_value: 'HIGH' | 'MEDIUM' | 'LOW';
  worth_it: string;
  instructions: string[];
}

export interface MissionTask {
  priority_ref: number;
  progress: 'completed' | 'in-progress' | 'blocked' | 'not-started';
  last_progress_at?: string;
  task: string;
  instructions: string[];
  depends_on?: string[];
}

export interface Mission {
  model: 'standard' | 'research' | 'evolution' | 'analytics';
  objective: string;
  priority: Priority;
  last_progress_at?: string;
  state: {
    status: boolean;
    class: MissionClass;
    progress: string;
  };
  rounds: {
    status: boolean;
    persistent: boolean;
    max: number;
  };
  metrics: {
    goals: number;
    progress_percentage: string;
    tasks: number;
    round_progress_percentage?: string;
    round: number;
  };
  runtime?: {
    recent_events?: string[];
    review_queue?: string[];
    backlog?: string[];
  };
  goals: Record<string, MissionGoal>;
  tasks: Record<string, MissionTask>;
}

export interface MissionsYaml {
  standard: Record<string, Mission>;
  research: Record<string, Mission>;
  evolution: {
    FAST: Record<string, any>;
    DEEP: Record<string, any>;
    RESEARCH?: Record<string, any>;
    INBOX?: Record<string, any>;
    ANALYTICS?: Record<string, any>;
  };
  analytics: Record<string, Mission>;
  archived?: {
    completed: Record<string, Mission>;
  };
}

export interface Toolbox {
  role?: string;
  when_to_use?: string;
  triggers?: string[];
  inputs?: string[];
  outputs?: string[];
  maturity: 'stub' | 'functional' | 'hardened' | 'battle-tested';
  status?: boolean;
}

export interface ToolboxesYaml {
  freshness?: Record<string, any>;
  metrics?: Record<string, any>;
  active_domains?: string[];
  domains: Record<string, {
    status: boolean;
    toolboxes: Record<string, {
      status: boolean;
      maturity?: string;
      skills?: Record<string, Toolbox>;
      agents?: Record<string, Toolbox>;
    }>;
  }>;
}

export interface InboxItem {
  name: string;
  status: 'needs_discovery' | 'needs_semantics' | 'ready_to_route' | 'rejected' | 'routed';
  path: string;
  semantics?: {
    description: string;
    contains: string[];
    when_to_use: string[];
  };
  disposition?: {
    action: 'route' | 'reject';
    pillar?: string;
    aspect?: 'Architecture' | 'Capabilities' | 'Monetization';
    fg?: string;
  };
}

export interface InboxYaml {
  metrics: {
    raw_items: number;
    gateway_items: number;
    analysing_items: number;
  };
  discovery: string[];
  raw: Record<string, InboxItem>;
  analysing: Record<string, InboxItem>;
  gateway: Record<string, InboxItem>;
}

export interface PromptsYaml {
  freshness?: Record<string, any>;
  prompts: Record<string, {
    file: string;
    title: string;
    role: string;
    contains: string[];
  }>;
}

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
