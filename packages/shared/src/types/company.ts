export interface Company {
  id: string;
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
  job_titles: string[];
  tags: string[];
  notes?: string;
  source?: string;
  last_verified_at?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListCompaniesResult {
  data: Company[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

