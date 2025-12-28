import { CompaniesModel, CreateCompanyData, UpdateCompanyData, ListCompaniesParams } from '../models/companiesModel';
import { logger } from '../middlewares';

export class CompaniesService {
  private model: CompaniesModel;

  constructor() {
    this.model = new CompaniesModel();
  }

  async createCompany(data: CreateCompanyData) {
    try {
      // Normalize data
      const normalized = this.normalizeCompanyData(data);
      return await this.model.create(normalized);
    } catch (error) {
      logger.error('Error creating company:', error);
      throw error;
    }
  }

  async getCompany(id: string) {
    try {
      const company = await this.model.findById(id);
      if (!company) {
        throw new Error('Company not found');
      }
      return company;
    } catch (error) {
      logger.error('Error getting company:', error);
      throw error;
    }
  }

  async listCompanies(params: ListCompaniesParams) {
    try {
      return await this.model.list(params);
    } catch (error) {
      logger.error('Error listing companies:', error);
      throw error;
    }
  }

  async updateCompany(id: string, data: UpdateCompanyData) {
    try {
      // Normalize data
      const normalized = this.normalizeCompanyData(data);
      return await this.model.update(id, normalized);
    } catch (error) {
      logger.error('Error updating company:', error);
      throw error;
    }
  }

  async deleteCompany(id: string) {
    try {
      await this.model.softDelete(id);
      return { ok: true };
    } catch (error) {
      logger.error('Error deleting company:', error);
      throw error;
    }
  }

  private normalizeCompanyData(data: CreateCompanyData | UpdateCompanyData): any {
    const normalized: any = { ...data };

    // Trim strings
    if (normalized.name) normalized.name = normalized.name.trim();
    if (normalized.address_text) normalized.address_text = normalized.address_text.trim();
    if (normalized.headquarters_country) normalized.headquarters_country = normalized.headquarters_country.trim();
    if (normalized.headquarters_city) normalized.headquarters_city = normalized.headquarters_city.trim();
    if (normalized.website) normalized.website = normalized.website.trim();
    if (normalized.primary_email) normalized.primary_email = normalized.primary_email.trim().toLowerCase();
    if (normalized.hr_email) normalized.hr_email = normalized.hr_email.trim().toLowerCase();
    if (normalized.phone) normalized.phone = normalized.phone.trim();
    if (normalized.linkedin_url) normalized.linkedin_url = normalized.linkedin_url.trim();
    if (normalized.industry) normalized.industry = normalized.industry.trim();
    if (normalized.size_range) normalized.size_range = normalized.size_range.trim();
    if (normalized.description) normalized.description = normalized.description.trim();
    if (normalized.logo_url) normalized.logo_url = normalized.logo_url.trim();
    if (normalized.notes) normalized.notes = normalized.notes.trim();
    if (normalized.source) normalized.source = normalized.source.trim();

    // Normalize website URL - add protocol if missing
    if (normalized.website && !normalized.website.match(/^https?:\/\//)) {
      normalized.website = `https://${normalized.website}`;
    }

    // Normalize arrays - trim and filter empty
    if (normalized.job_titles) {
      normalized.job_titles = normalized.job_titles
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0 && t.length <= 50);
    }
    if (normalized.tags) {
      normalized.tags = normalized.tags
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0 && t.length <= 50);
    }

    return normalized;
  }
}

