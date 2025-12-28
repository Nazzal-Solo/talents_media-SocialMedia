import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/toast-context';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { companiesApi } from '@/lib/companies-api';
import {
  Building2,
  ArrowLeft,
  Edit,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Users,
  Calendar,
  Briefcase,
  Tag,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ApplyCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id!),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      showToast('Company deleted successfully', 'success');
      navigate('/apply/companies');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.error || 'Failed to delete company', 'error');
    },
  });

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (company) {
      deleteMutation.mutate(company.id);
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </>
    );
  }

  if (error || !company) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <div className="glass-card p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Company Not Found</h2>
            <p className="text-tm-text-muted mb-6">The company you're looking for doesn't exist.</p>
            <Link
              to="/apply/companies"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Companies
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{company.name} - Companies Database - Talents Media</title>
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
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="h-20 w-20 rounded-lg object-cover border-2 border-tm-border"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-tm-bg/50 flex items-center justify-center border-2 border-tm-border">
                    <Building2 className="h-10 w-10 text-tm-text-muted" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-tm-primary-from hover:text-tm-primary-to transition"
                    >
                      <Globe className="h-4 w-4" />
                      {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/apply/companies/${company.id}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-tm-bg border border-tm-border rounded-lg hover:bg-tm-bg/50 transition"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-6">
            {company.is_active ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                <CheckCircle className="h-4 w-4" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
                <XCircle className="h-4 w-4" />
                Inactive
              </span>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Address */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-tm-primary-from" />
                Location
              </h3>
              <div className="space-y-2 text-sm">
                <div className="text-tm-text">{company.address_text}</div>
                {company.headquarters_city && (
                  <div className="text-tm-text-muted">
                    {company.headquarters_city}, {company.headquarters_country}
                  </div>
                )}
                {!company.headquarters_city && (
                  <div className="text-tm-text-muted">{company.headquarters_country}</div>
                )}
              </div>
            </div>

            {/* Contacts */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-tm-primary-from" />
                Contacts
              </h3>
              <div className="space-y-2 text-sm">
                {company.primary_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-tm-text-muted" />
                    <a
                      href={`mailto:${company.primary_email}`}
                      className="text-tm-primary-from hover:text-tm-primary-to transition"
                    >
                      {company.primary_email}
                    </a>
                  </div>
                )}
                {company.hr_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-tm-text-muted" />
                    <span className="text-tm-text-muted">HR: </span>
                    <a
                      href={`mailto:${company.hr_email}`}
                      className="text-tm-primary-from hover:text-tm-primary-to transition"
                    >
                      {company.hr_email}
                    </a>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-tm-text-muted" />
                    <a
                      href={`tel:${company.phone}`}
                      className="text-tm-primary-from hover:text-tm-primary-to transition"
                    >
                      {company.phone}
                    </a>
                  </div>
                )}
                {company.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-tm-text-muted" />
                    <a
                      href={company.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tm-primary-from hover:text-tm-primary-to transition"
                    >
                      LinkedIn Profile
                      <ExternalLink className="h-3 w-3 inline ml-1" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Company Info */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-tm-primary-from" />
                Company Info
              </h3>
              <div className="space-y-2 text-sm">
                {company.industry && (
                  <div>
                    <span className="text-tm-text-muted">Industry: </span>
                    <span className="text-tm-text">{company.industry}</span>
                  </div>
                )}
                {company.size_range && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-tm-text-muted" />
                    <span className="text-tm-text-muted">Size: </span>
                    <span className="text-tm-text">{company.size_range}</span>
                  </div>
                )}
                {company.founded_year && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-tm-text-muted" />
                    <span className="text-tm-text-muted">Founded: </span>
                    <span className="text-tm-text">{company.founded_year}</span>
                  </div>
                )}
                {company.source && (
                  <div>
                    <span className="text-tm-text-muted">Source: </span>
                    <span className="text-tm-text">{company.source}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-tm-primary-from" />
                Metadata
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-tm-text-muted">Created: </span>
                  <span className="text-tm-text">
                    {formatDistanceToNow(new Date(company.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div>
                  <span className="text-tm-text-muted">Updated: </span>
                  <span className="text-tm-text">
                    {formatDistanceToNow(new Date(company.updated_at), { addSuffix: true })}
                  </span>
                </div>
                {company.last_verified_at && (
                  <div>
                    <span className="text-tm-text-muted">Last Verified: </span>
                    <span className="text-tm-text">
                      {formatDistanceToNow(new Date(company.last_verified_at), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {company.description && (
            <div className="glass-card p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-tm-primary-from" />
                Description
              </h3>
              <p className="text-tm-text whitespace-pre-wrap">{company.description}</p>
            </div>
          )}

          {/* Job Titles */}
          {company.job_titles && company.job_titles.length > 0 && (
            <div className="glass-card p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-tm-primary-from" />
                Job Titles
              </h3>
              <div className="flex flex-wrap gap-2">
                {company.job_titles.map((title, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-tm-primary-from/20 text-tm-primary-from rounded-full text-sm"
                  >
                    {title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {company.tags && company.tags.length > 0 && (
            <div className="glass-card p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-tm-primary-from" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {company.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-tm-bg border border-tm-border text-tm-text rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {company.notes && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-tm-primary-from" />
                Internal Notes
              </h3>
              <p className="text-tm-text-muted whitespace-pre-wrap">{company.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Company"
        description={
          company
            ? `Are you sure you want to delete "${company.name}"? This action cannot be undone.`
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

