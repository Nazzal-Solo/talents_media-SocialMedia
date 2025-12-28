import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-context';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { companiesApi, ListCompaniesParams } from '@/lib/companies-api';
import { Company } from '@talents-media/shared';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Mail,
  MapPin,
  Users,
  Briefcase,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ApplyCompaniesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<{ id: string; name: string } | null>(null);

  const params: ListCompaniesParams = {
    page,
    limit,
    q: searchQuery || undefined,
    country: countryFilter || undefined,
    is_active: activeFilter,
    sort: 'created_at',
    order: 'desc',
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', params],
    queryFn: () => companiesApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      showToast('Company deleted successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.error || 'Failed to delete company', 'error');
    },
  });

  const companies = data?.data || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;

  const handleDelete = (id: string, name: string) => {
    setCompanyToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (companyToDelete) {
      deleteMutation.mutate(companyToDelete.id);
      setCompanyToDelete(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  // Get unique countries for filter
  const countries = Array.from(
    new Set(companies.map((c) => c.headquarters_country).filter(Boolean))
  ).sort();

  return (
    <>
      <Helmet>
        <title>Companies Database - Apply System - Talents Media</title>
      </Helmet>

      <Navbar />

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              to="/apply"
              className="text-tm-text-muted hover:text-tm-text mb-4 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <Building2 className="h-8 w-8 text-tm-primary-from" />
                  Companies Database
                </h1>
                <p className="text-tm-text-muted">
                  Dev tools: Companies database for managing company information
                </p>
              </div>
              <Link
                to="/apply/companies/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition"
              >
                <Plus className="h-4 w-4" />
                Add Company
              </Link>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="glass-card p-4 mb-6">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-tm-text-muted" />
                <input
                  type="text"
                  placeholder="Search companies by name, website, email, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
                />
              </div>
              <select
                value={countryFilter}
                onChange={(e) => {
                  setCountryFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
              >
                <option value="">All Countries</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              <select
                value={activeFilter === undefined ? '' : activeFilter.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveFilter(val === '' ? undefined : val === 'true');
                  setPage(1);
                }}
                className="px-4 py-2 bg-tm-bg border border-tm-border rounded-lg text-tm-text focus:outline-none focus:ring-2 focus:ring-tm-primary-from"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="px-4 py-2 text-tm-text-muted hover:text-tm-text"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </form>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="glass-card p-8 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error Loading Companies</h2>
              <p className="text-tm-text-muted">Please try again later.</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Building2 className="h-16 w-16 text-tm-text-muted mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No companies yet</h2>
              <p className="text-tm-text-muted mb-6">
                Get started by adding your first company to the database.
              </p>
              <Link
                to="/apply/companies/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition"
              >
                <Plus className="h-4 w-4" />
                Add Company
              </Link>
            </div>
          ) : (
            <>
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-tm-bg/50 border-b border-tm-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-tm-text">Company</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-tm-text">Location</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-tm-text">Contacts</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-tm-text">Size</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-tm-text">Job Titles</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-tm-text">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-tm-text">Updated</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-tm-text">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((company) => (
                        <tr
                          key={company.id}
                          className="border-b border-tm-border/50 hover:bg-tm-bg/30 transition"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {company.logo_url ? (
                                <img
                                  src={company.logo_url}
                                  alt={company.name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded bg-tm-bg/50 flex items-center justify-center">
                                  <Building2 className="h-5 w-5 text-tm-text-muted" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-tm-text">{company.name}</div>
                                {company.website && (
                                  <a
                                    href={company.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-tm-text-muted hover:text-tm-primary-from flex items-center gap-1"
                                  >
                                    {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-tm-text">
                              {company.headquarters_city && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-tm-text-muted" />
                                  {company.headquarters_city}
                                </div>
                              )}
                              <div className="text-tm-text-muted text-xs mt-1">
                                {company.headquarters_country}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm space-y-1">
                              {company.primary_email && (
                                <div className="flex items-center gap-1 text-tm-text-muted">
                                  <Mail className="h-3 w-3" />
                                  <span className="text-xs">{company.primary_email}</span>
                                </div>
                              )}
                              {company.hr_email && (
                                <div className="flex items-center gap-1 text-tm-text-muted">
                                  <Mail className="h-3 w-3" />
                                  <span className="text-xs">HR: {company.hr_email}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {company.size_range ? (
                              <div className="flex items-center gap-1 text-sm text-tm-text">
                                <Users className="h-4 w-4 text-tm-text-muted" />
                                {company.size_range}
                              </div>
                            ) : (
                              <span className="text-tm-text-muted text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {company.job_titles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {company.job_titles.slice(0, 2).map((title, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 text-xs bg-tm-primary-from/20 text-tm-primary-from rounded"
                                  >
                                    {title}
                                  </span>
                                ))}
                                {company.job_titles.length > 2 && (
                                  <span className="px-2 py-0.5 text-xs text-tm-text-muted">
                                    +{company.job_titles.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-tm-text-muted text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {company.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                                <CheckCircle className="h-3 w-3" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">
                                <XCircle className="h-3 w-3" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-tm-text-muted">
                              {formatDistanceToNow(new Date(company.updated_at), { addSuffix: true })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/apply/companies/${company.id}`}
                                className="p-2 text-tm-text-muted hover:text-tm-primary-from transition"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                              <Link
                                to={`/apply/companies/${company.id}/edit`}
                                className="p-2 text-tm-text-muted hover:text-tm-primary-from transition"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(company.id, company.name)}
                                className="p-2 text-tm-text-muted hover:text-red-500 transition"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-tm-text-muted">
                    Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} companies
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg bg-tm-bg border border-tm-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tm-bg/50 transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-tm-text px-4">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg bg-tm-bg border border-tm-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tm-bg/50 transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Company"
        description={
          companyToDelete
            ? `Are you sure you want to delete "${companyToDelete.name}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}

