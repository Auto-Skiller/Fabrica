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
