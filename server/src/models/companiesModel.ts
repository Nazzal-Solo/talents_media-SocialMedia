import { query } from './db';

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

export interface ListCompaniesParams {
  page?: number;
  limit?: number;
  q?: string;
  country?: string;
  is_active?: boolean;
  sort?: 'created_at' | 'name';
  order?: 'asc' | 'desc';
}

export interface ListCompaniesResult {
  data: Company[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class CompaniesModel {
  async create(data: CreateCompanyData): Promise<Company> {
    const result = await query<Company>(
      `INSERT INTO companies (
        name, address_text, headquarters_country, headquarters_city,
        website, primary_email, hr_email, phone, linkedin_url,
        industry, size_range, founded_year, description, logo_url,
        job_titles, tags, notes, source, last_verified_at, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *`,
      [
        data.name,
        data.address_text,
        data.headquarters_country,
        data.headquarters_city || null,
        data.website || null,
        data.primary_email || null,
        data.hr_email || null,
        data.phone || null,
        data.linkedin_url || null,
        data.industry || null,
        data.size_range || null,
        data.founded_year || null,
        data.description || null,
        data.logo_url || null,
        data.job_titles || [],
        data.tags || [],
        data.notes || null,
        data.source || null,
        data.last_verified_at || null,
        data.is_active !== undefined ? data.is_active : true,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Company | null> {
    const result = await query<Company>(
      'SELECT * FROM companies WHERE id = $1 AND is_deleted = false',
      [id]
    );
    return result.rows[0] || null;
  }

  async list(params: ListCompaniesParams): Promise<ListCompaniesResult> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sort = params.sort || 'created_at';
    const order = params.order || 'desc';

    let whereConditions = ['is_deleted = false'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Search query
    if (params.q) {
      whereConditions.push(`(
        lower(name) LIKE lower($${paramIndex})
        OR lower(coalesce(website,'')) LIKE lower($${paramIndex})
        OR lower(coalesce(primary_email,'')) LIKE lower($${paramIndex})
        OR lower(coalesce(hr_email,'')) LIKE lower($${paramIndex})
        OR array_to_string(job_titles,' ') ILIKE $${paramIndex}
        OR array_to_string(tags,' ') ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${params.q}%`);
      paramIndex++;
    }

    // Country filter
    if (params.country) {
      whereConditions.push(`headquarters_country = $${paramIndex}`);
      queryParams.push(params.country);
      paramIndex++;
    }

    // Active filter
    if (params.is_active !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      queryParams.push(params.is_active);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM companies WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get data
    const orderBy = sort === 'name' ? 'name ASC' : 'created_at DESC';
    const dataResult = await query<Company>(
      `SELECT * FROM companies WHERE ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    return {
      data: dataResult.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, data: UpdateCompanyData): Promise<Company> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: (keyof UpdateCompanyData)[] = [
      'name', 'address_text', 'headquarters_country', 'headquarters_city',
      'website', 'primary_email', 'hr_email', 'phone', 'linkedin_url',
      'industry', 'size_range', 'founded_year', 'description', 'logo_url',
      'job_titles', 'tags', 'notes', 'source', 'last_verified_at', 'is_active',
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      // No updates, just return existing record
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error('Company not found');
      }
      return existing;
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);
    
    // Add id as the last parameter
    values.push(id);

    const result = await query<Company>(
      `UPDATE companies SET ${updates.join(', ')} WHERE id = $${paramIndex} AND is_deleted = false RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }

    return result.rows[0];
  }

  async softDelete(id: string): Promise<void> {
    const result = await query(
      `UPDATE companies SET is_deleted = true, is_active = false, updated_at = NOW() WHERE id = $1 AND is_deleted = false RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }
  }
}

