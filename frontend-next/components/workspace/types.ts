export interface WorkspaceItemLevel {
  maturity: 'draft' | 'beta' | 'production' | string;
  readability: 'low' | 'medium' | 'high' | string;
}

export interface WorkspaceItem {
  id?: string;
  name: string;
  path: string;
  isDirectory: boolean;
  type: string;
  level: WorkspaceItemLevel;
  description: string;
  when_to_use: string;
  triggers: string[];
  size: number;
  modified_at: string;
  created_at?: string;
  flagged_as_action?: boolean;
}

export type WorkspaceSourceItem = WorkspaceItem;
export type WorkspaceDeliverableItem = WorkspaceItem;

export interface WorkspaceMap {
  sources: {
    discovery_and_scoping: WorkspaceSourceItem[];
    deep_research: WorkspaceSourceItem[];
    data_analysis: WorkspaceSourceItem[];
    strategic_synthesis: WorkspaceSourceItem[];
    all: WorkspaceSourceItem[];
  };
  deliverables: {
    executions: WorkspaceDeliverableItem[];
    reviews: WorkspaceDeliverableItem[];
    completed: WorkspaceDeliverableItem[];
    all: WorkspaceDeliverableItem[];
  };
  action_items: WorkspaceItem[];
  updated_at: string;
}
