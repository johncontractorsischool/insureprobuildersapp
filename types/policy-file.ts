export type PolicyFileOrFolder = 'File' | 'Folder';

export type PolicyFileEntry = {
  databaseId: string;
  documentKey: string;
  source: 'PBIA' | 'MOMENTUM';
  openStatus: 'AVAILABLE' | 'UNAVAILABLE';
  insuredId: string | null;
  policyId: string | null;
  policyNumber: string | null;
  name: string;
  type: number | null;
  createDate: string | null;
  changeDate: string | null;
  creatorName: string | null;
  fileOrFolder: PolicyFileOrFolder;
  fileUrl: string | null;
  downloadUrl: string | null;
  url: string | null;
  mimeType?: string | null;
  size?: number | null;
  description?: string | null;
  parentId?: string | null;
};

export type PolicyFilesListResponse = {
  data: PolicyFileEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  partial: boolean;
  totalScope: 'ALL_SOURCES' | 'AVAILABLE_SOURCES';
  sources: { pbia: 'AVAILABLE'; momentum: 'AVAILABLE' | 'UNAVAILABLE' };
};
