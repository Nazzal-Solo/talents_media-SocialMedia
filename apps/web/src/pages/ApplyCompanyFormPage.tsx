import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/toast-context';
import { companiesApi, CreateCompanyData, UpdateCompanyData } from '@/lib/companies-api';
import { ChipInput } from '@/components/apply/ChipInput';
import { Save, ArrowLeft, Building2 } from 'lucide-react';

const currentYear = new Date().getFullYear();

const companySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address_text: z.string().min(1, 'Address is required'),
  headquarters_country: z.string().min(1, 'Country is required').max(100),
  headquarters_city: z.string().max(100).optional().or(z.literal('')),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  primary_email: z.string().email('Invalid email').optional().or(z.literal('')),
  hr_email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  size_range: z.string().max(50).optional().or(z.literal('')),
  founded_year: z.number().int().min(1800).max(currentYear).optional().nullable(),
  description: z.string().optional().or(z.literal('')),
  logo_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  job_titles: z.array(z.string().max(50)).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().optional().or(z.literal('')),
  source: z.string().max(100).optional().or(z.literal('')),
  last_verified_at: z.string().datetime().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

const SIZE_RANGES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

export default function ApplyCompanyFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id!),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      address_text: '',
      headquarters_country: '',
      headquarters_city: '',
      website: '',
      primary_email: '',
      hr_email: '',
      phone: '',
      linkedin_url: '',
      industry: '',
      size_range: '',
      founded_year: null,
      description: '',
      logo_url: '',
      job_titles: [],
      tags: [],
      notes: '',
      source: '',
      last_verified_at: '',
      is_active: true,
    },
  });

  const jobTitles = watch('job_titles') || [];
  const tags = watch('tags') || [];

  useEffect(() => {
    if (company) {
      reset({
        name: company.name || '',
        address_text: company.address_text || '',
        headquarters_country: company.headquarters_country || '',
        headquarters_city: company.headquarters_city || '',
        website: company.website || '',
        primary_email: company.primary_email || '',
        hr_email: company.hr_email || '',
        phone: company.phone || '',
        linkedin_url: company.linkedin_url || '',
        industry: company.industry || '',
        size_range: company.size_range || '',
        founded_year: company.founded_year || null,
        description: company.description || '',
        logo_url: company.logo_url || '',
        job_titles: company.job_titles || [],
        tags: company.tags || [],
        notes: company.notes || '',
        source: company.source || '',
        last_verified_at: company.last_verified_at || '',
        is_active: company.is_active ?? true,
      });
    }
  }, [company, reset]);

  const createMutation = useMutation({
    mutationFn: (data: CreateCompanyData) => companiesApi.create(data),
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      showToast('Company created successfully', 'success');
      navigate(`/apply/companies/${company.id}`);
    },
    onError: (error: any) => {
      showToast(error.response?.data?.error || 'Failed to create company', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCompanyData) => companiesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      showToast('Company updated successfully', 'success');
      navigate(`/apply/companies/${id}`);
    },
    onError: (error: any) => {
      showToast(error.response?.data?.error || 'Failed to update company', 'error');
    },
  });

  const onSubmit = async (data: CompanyFormData) => {
    // Normalize empty strings to undefined
    const normalized: CreateCompanyData | UpdateCompanyData = {
      ...data,
      website: data.website || undefined,
      primary_email: data.primary_email || undefined,
      hr_email: data.hr_email || undefined,
      phone: data.phone || undefined,
      linkedin_url: data.linkedin_url || undefined,
      industry: data.industry || undefined,
      size_range: data.size_range || undefined,
      description: data.description || undefined,
      logo_url: data.logo_url || undefined,
      notes: data.notes || undefined,
      source: data.source || undefined,
      last_verified_at: data.last_verified_at || undefined,
      headquarters_city: data.headquarters_city || undefined,
      founded_year: data.founded_year || undefined,
    };

    // Normalize website URL
    if (normalized.website && !normalized.website.match(/^https?:\/\//)) {
      normalized.website = `https://${normalized.website}`;
    }

    if (isEdit) {
      updateMutation.mutate(normalized);
    } else {
      createMutation.mutate(normalized as CreateCompanyData);
    }
  };

  if (isEdit && isLoadingCompany) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isEdit ? 'Edit Company' : 'New Company'} - Companies Database - Talents Media</title>
      </Helmet>

      <Navbar />

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              to="/apply/companies"
              className="text-tm-text-muted hover:text-tm-text mb-4 inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Companies
            </Link>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-tm-primary-from" />
              {isEdit ? 'Edit Company' : 'New Company'}
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basics Section */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">Basics</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('name')}
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    {...register('address_text')}
                    rows={2}
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.address_text && <p className="text-red-500 text-sm mt-1">{errors.address_text.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('headquarters_country')}
                      className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                    />
                    {errors.headquarters_country && (
                      <p className="text-red-500 text-sm mt-1">{errors.headquarters_country.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">City</label>
                    <input
                      {...register('headquarters_city')}
                      className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Website</label>
                  <input
                    {...register('website')}
                    type="url"
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.website && <p className="text-red-500 text-sm mt-1">{errors.website.message}</p>}
                </div>
              </div>
            </div>

            {/* Contacts Section */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">Contacts</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Primary Email</label>
                  <input
                    {...register('primary_email')}
                    type="email"
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.primary_email && <p className="text-red-500 text-sm mt-1">{errors.primary_email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">HR Email</label>
                  <input
                    {...register('hr_email')}
                    type="email"
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.hr_email && <p className="text-red-500 text-sm mt-1">{errors.hr_email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    {...register('phone')}
                    type="tel"
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">LinkedIn URL</label>
                  <input
                    {...register('linkedin_url')}
                    type="url"
                    placeholder="https://linkedin.com/company/example"
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.linkedin_url && <p className="text-red-500 text-sm mt-1">{errors.linkedin_url.message}</p>}
                </div>
              </div>
            </div>

            {/* Metadata Section */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">Metadata</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Industry</label>
                    <input
                      {...register('industry')}
                      className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Size Range</label>
                    <select
                      {...register('size_range')}
                      className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                    >
                      <option value="">Select size</option>
                      {SIZE_RANGES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Founded Year</label>
                  <input
                    {...register('founded_year', { valueAsNumber: true })}
                    type="number"
                    min={1800}
                    max={currentYear}
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.founded_year && <p className="text-red-500 text-sm mt-1">{errors.founded_year.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    {...register('description')}
                    rows={4}
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Logo URL</label>
                  <input
                    {...register('logo_url')}
                    type="url"
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                  {errors.logo_url && <p className="text-red-500 text-sm mt-1">{errors.logo_url.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Source</label>
                  <input
                    {...register('source')}
                    placeholder="manual, linkedin, website, etc."
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Last Verified At</label>
                  <input
                    {...register('last_verified_at')}
                    type="datetime-local"
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    {...register('is_active')}
                    type="checkbox"
                    className="w-4 h-4 rounded border-tm-border bg-tm-bg text-tm-primary-from focus:ring-tm-primary-from"
                  />
                  <label className="text-sm font-medium">Active</label>
                </div>
              </div>
            </div>

            {/* Hiring Data Section */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">Hiring Data</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Job Titles</label>
                  <ChipInput
                    value={jobTitles}
                    onChange={(value) => setValue('job_titles', value)}
                    placeholder="Type job title and press Enter"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tags</label>
                  <ChipInput
                    value={tags}
                    onChange={(value) => setValue('tags', value)}
                    placeholder="Type tag and press Enter"
                  />
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">Notes</h2>
              <div>
                <label className="block text-sm font-medium mb-2">Internal Notes</label>
                <textarea
                  {...register('notes')}
                  rows={4}
                  className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                  placeholder="Internal development notes..."
                />
              </div>
            </div>

            {/* Save Button - Sticky */}
            <div className="sticky bottom-0 glass-card p-4 border-t border-tm-border">
              <div className="flex items-center justify-end gap-4">
                <Link
                  to={isEdit ? `/apply/companies/${id}` : '/apply/companies'}
                  className="px-4 py-2 text-tm-text-muted hover:text-tm-text transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

