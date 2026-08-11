export type PolicyFileOrFolder = 'File' | 'Folder';

export type PolicyFileEntry = {
  databaseId: string;
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
  status: number;
  data: PolicyFileEntry[];
  message: string | null;
};
