import { apiClient } from './api-client';
import { Company, ListCompaniesResult } from '@talents-media/shared';

export interface CreateCompanyData {
  name: string;
  address_text: string;
  headquarters_country: string;
  headquarters_city?: string;
  website?: string;
  primary_email?: string;
  hr_email?: string;
  phone?: string;
  linkedin_url?: string;
  industry?: string;
  size_range?: string;
  founded_year?: number;
  description?: string;
  logo_url?: string;
  job_titles?: string[];
  tags?: string[];
  notes?: string;
  source?: string;
  last_verified_at?: string;
  is_active?: boolean;
}

export interface UpdateCompanyData {
  name?: string;
  address_text?: string;
  headquarters_country?: string;
  headquarters_city?: string;
  website?: string | null;
  primary_email?: string | null;
  hr_email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  size_range?: string | null;
  founded_year?: number | null;
  description?: string | null;
  logo_url?: string | null;
  job_titles?: string[] | null;
  tags?: string[] | null;
  notes?: string | null;
  source?: string | null;
  last_verified_at?: string | null;
  is_active?: boolean;
}

export interface ListCompaniesParams {
  page?: number;
  limit?: number;
  q?: string;
  country?: string;
  is_active?: boolean;
  sort?: 'created_at' | 'name';
  order?: 'asc' | 'desc';
}

export const companiesApi = {
  create: async (data: CreateCompanyData): Promise<Company> => {
    return apiClient.post('/api/companies', data);
  },

  get: async (id: string): Promise<Company> => {
    return apiClient.get(`/api/companies/${id}`);
  },

  list: async (params?: ListCompaniesParams): Promise<ListCompaniesResult> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.q) queryParams.append('q', params.q);
    if (params?.country) queryParams.append('country', params.country);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.order) queryParams.append('order', params.order);

    const queryString = queryParams.toString();
    return apiClient.get(`/api/companies${queryString ? `?${queryString}` : ''}`);
  },

  update: async (id: string, data: UpdateCompanyData): Promise<Company> => {
    return apiClient.patch(`/api/companies/${id}`, data);
  },

  delete: async (id: string): Promise<{ ok: boolean }> => {
    return apiClient.delete(`/api/companies/${id}`);
  },
};

