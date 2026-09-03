export type CompetitionStatus = 'open' | 'locked';

export interface Competition {
  id: string;
  name: string;
  createdAt: number;
  opensAt: number | null;
  closesAt: number | null;
  status: CompetitionStatus;
  entryCount: number;
}

export interface Entry {
  id: string;
  competitionId: string;
  photographer: string;
  title: string;
  originalFilename: string;
  contentType: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  uploadedAt: number;
  excluded: boolean;
  thumbnailUrl?: string;
  originalUrl?: string;
}

export interface PortalSettings {
  memberGateEnabled: boolean;
}
