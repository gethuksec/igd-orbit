import { api, handleApiError } from "./api";

export type ContractType = "trial" | "probation" | "pkwt" | "pkwtt";
export type ContractStatus = "draft" | "active" | "expired" | "terminated" | "renewed";

export interface Contract {
  id: string;
  contractNumber: string;
  employeeId: string;
  type: ContractType;
  startDate: string;
  endDate: string | null;
  probationEndDate: string | null;
  basicSalary: number | null;
  positionId: string | null;
  gradeId: string | null;
  divisionId: string | null;
  departmentId: string | null;
  changeReason: string | null;
  status: ContractStatus;
  previousContractId: string | null;
  approvedBy: string | null;
  employee?: { id: string; userId: string; employeeCode: string } | null;
  contractWorkingLocations?: { workingLocation: { id: string; code: string; name: string } }[];
  position?: { id: string; code: string; name: string } | null;
  grade?: { id: string; code: string; name: string } | null;
  division?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  contractBranches?: { branch: { id: string; code: string; name: string }; isPrimary: boolean }[];
}

export interface ContractListResponse {
  data: Contract[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface IntakePayload {
  fullName: string;
  email: string;
  password: string;
  username?: string;
  phone?: string;
  type: ContractType;
  startDate: string;
  endDate?: string;
  probationEndDate?: string;
  workingLocationIds?: string[];
  basicSalary?: number;
  positionId?: string;
  gradeId?: string;
  divisionId?: string;
  departmentId?: string;
  branchIds?: string[];
  primaryBranchId?: string;
  roleId?: string;
  status?: string;
}

const emptyMeta = (page = 1, limit = 20) => ({ page, limit, total: 0, totalPages: 0 });

export const contractsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
    employeeId?: string;
  }): Promise<ContractListResponse> {
    try {
      const response = await api.get("/contracts", { params });
      const body = response.data;
      if (Array.isArray(body?.data)) return body;
      return { data: body?.data ?? [], meta: body?.meta ?? emptyMeta(params?.page, params?.limit) };
    } catch (error: any) {
      return handleApiError(error, { data: [], meta: emptyMeta(params?.page, params?.limit) });
    }
  },

  async getById(id: string): Promise<Contract> {
    const response = await api.get(`/contracts/${id}`);
    return response.data.data || response.data;
  },

  async getChain(employeeId: string): Promise<{ data: Contract[]; total: number }> {
    try {
      const response = await api.get(`/contracts/employee/${employeeId}/chain`);
      const body = response.data;
      return { data: body?.data ?? [], total: body?.total ?? 0 };
    } catch (error: any) {
      return handleApiError(error, { data: [], total: 0 });
    }
  },

  async getTenureAnchor(
    employeeId: string,
  ): Promise<{ employeeId: string; tenureAnchor: string | null; hireDate: string | null }> {
    const response = await api.get(`/contracts/employee/${employeeId}/tenure-anchor`);
    return response.data;
  },

  async suggestRole(
    positionId: string,
  ): Promise<{ positionId: string; suggestedRole: { id: string; code: string; name: string } | null }> {
    const response = await api.get("/contracts/intake-suggest", { params: { positionId } });
    return response.data;
  },

  async intake(payload: IntakePayload) {
    const response = await api.post("/contracts/intake", payload);
    return response.data.data || response.data;
  },

  async create(payload: Partial<Contract> & {
    employeeId: string;
    type: ContractType;
    startDate: string;
    contractNumber?: string;
    gradeId?: string;
    workingLocationIds?: string[];
    branchIds?: string[];
    primaryBranchId?: string;
    changeReason?: string;
    previousContractId?: string;
  }) {
    const response = await api.post("/contracts", payload);
    return response.data.data || response.data;
  },

  async update(id: string, payload: Partial<Contract>) {
    const response = await api.put(`/contracts/${id}`, payload);
    return response.data.data || response.data;
  },

  async dryRunImport(file: File): Promise<ContractImportDryRun> {
    const form = new FormData();
    form.append("file", file);
    const response = await api.post("/contracts/import/dry-run", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async commitImport(file: File): Promise<ContractImportCommit> {
    const form = new FormData();
    form.append("file", file);
    const response = await api.post("/contracts/import/commit", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async downloadImportTemplate(): Promise<Blob> {
    const response = await api.get("/contracts/import/template", { responseType: "blob" });
    return response.data;
  },
};

export interface ContractImportRowReport {
  rowNumber: number;
  nip?: string;
  name?: string;
  status: "ok" | "error";
  errors: string[];
  incomplete: string[];
  notes: string[];
  preview: {
    type?: string;
    startDate?: string;
    endDate?: string | null;
    positionCode?: string | null;
    gradeCode?: string | null;
    divisionCode?: string | null;
    branchCodes?: string[];
    basicSalary?: number | null;
  };
}

export interface ContractImportDryRun {
  total: number;
  valid: number;
  invalid: number;
  rows: ContractImportRowReport[];
  multiRowEmployees: string[];
}

export interface ContractImportCommit extends ContractImportDryRun {
  created: { rowNumber: number; contractNumber: string; nip: string }[];
  skipped: { rowNumber: number; nip?: string; errors: string[] }[];
}
