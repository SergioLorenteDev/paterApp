export type CaseItem = {
  id: string;
  assetId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'blocked' | 'closed';
  openedAt: string;
};
