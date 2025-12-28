import { Request, Response } from 'express';
import { z } from 'zod';
import { CompaniesService } from '../services/companiesService';
import { logger } from '../middlewares';

const companiesService = new CompaniesService();

// Zod schemas
const createCompanySchema = z.object({
  name: z.string().min(1).max(255).trim(),
  address_text: z.string().min(1).trim(),
  headquarters_country: z.string().min(1).max(100).trim(),
  headquarters_city: z.string().max(100).trim().optional(),
  website: z.string().url().optional().or(z.literal('')),
  primary_email: z.string().email().optional().or(z.literal('')),
  hr_email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  size_range: z.string().max(50).optional(),
  founded_year: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  description: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  job_titles: z.array(z.string().max(50).trim()).optional(),
  tags: z.array(z.string().max(50).trim()).optional(),
  notes: z.string().optional(),
  source: z.string().max(100).optional(),
  last_verified_at: z.string().datetime().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
});

const updateCompanySchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  address_text: z.string().min(1).trim().optional(),
  headquarters_country: z.string().min(1).max(100).trim().optional(),
  headquarters_city: z.string().max(100).trim().optional(),
  website: z.string().url().optional().or(z.literal('')).nullable(),
  primary_email: z.string().email().optional().or(z.literal('')).nullable(),
  hr_email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().max(50).optional().nullable(),
  linkedin_url: z.string().url().optional().or(z.literal('')).nullable(),
  industry: z.string().max(100).optional().nullable(),
  size_range: z.string().max(50).optional().nullable(),
  founded_year: z.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  description: z.string().optional().nullable(),
  logo_url: z.string().url().optional().or(z.literal('')).nullable(),
  job_titles: z.array(z.string().max(50).trim()).optional().nullable(),
  tags: z.array(z.string().max(50).trim()).optional().nullable(),
  notes: z.string().optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  last_verified_at: z.string().datetime().optional().or(z.literal('')).nullable(),
  is_active: z.boolean().optional(),
});

const listCompaniesSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  q: z.string().optional(),
  country: z.string().optional(),
  is_active: z.string().transform((val) => val === 'true').optional(),
  sort: z.enum(['created_at', 'name']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export class CompaniesController {
  async createCompany(req: Request, res: Response): Promise<void> {
    try {
      const validated = createCompanySchema.parse(req.body);
      const company = await companiesService.createCompany(validated);
      res.status(201).json(company);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      logger.error('Error creating company:', error);
      res.status(500).json({ error: error.message || 'Failed to create company' });
    }
  }

  async getCompany(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const company = await companiesService.getCompany(id);
      res.json(company);
    } catch (error: any) {
      if (error.message === 'Company not found') {
        res.status(404).json({ error: 'Company not found' });
        return;
      }
      logger.error('Error getting company:', error);
      res.status(500).json({ error: error.message || 'Failed to get company' });
    }
  }

  async listCompanies(req: Request, res: Response): Promise<void> {
    try {
      const validated = listCompaniesSchema.parse(req.query);
      const result = await companiesService.listCompanies(validated);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      logger.error('Error listing companies:', error);
      res.status(500).json({ error: error.message || 'Failed to list companies' });
    }
  }

  async updateCompany(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validated = updateCompanySchema.parse(req.body);
      const company = await companiesService.updateCompany(id, validated);
      res.json(company);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error.message === 'Company not found') {
        res.status(404).json({ error: 'Company not found' });
        return;
      }
      logger.error('Error updating company:', error);
      res.status(500).json({ error: error.message || 'Failed to update company' });
    }
  }

  async deleteCompany(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await companiesService.deleteCompany(id);
      res.json({ ok: true });
    } catch (error: any) {
      if (error.message === 'Company not found') {
        res.status(404).json({ error: 'Company not found' });
        return;
      }
      logger.error('Error deleting company:', error);
      res.status(500).json({ error: error.message || 'Failed to delete company' });
    }
  }
}

