import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast-context';
import { AutocompleteInput } from '@/components/apply/AutocompleteInput';
import { LocationPicker } from '@/components/apply/LocationPicker';
import { CVUploader } from '@/components/apply/CVUploader';
import { Save, CheckCircle, Circle, Plus, X, DollarSign, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Location {
  display_name: string;
  country?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  location_type?: 'remote' | 'onsite' | 'hybrid';
}

const STEPS = [
  { id: 1, title: 'Skills', key: 'skills' },
  { id: 2, title: 'Job Titles', key: 'job_titles' },
  { id: 3, title: 'Locations', key: 'locations' },
  { id: 4, title: 'Salary Range', key: 'salary' },
  { id: 5, title: 'Keywords', key: 'keywords' },
  { id: 6, title: 'CV & Portfolio', key: 'assets' },
] as const;

export default function ApplyProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['apply-profile'],
    queryFn: () => apiClient.get('/api/apply/profile'),
  });

  const profile = (data as any)?.profile;

  const [formData, setFormData] = useState({
    skills: [] as string[],
    job_titles: [] as string[],
    locations: [] as Location[],
    salary_min: '',
    salary_max: '',
    salary_currency: 'USD',
    include_keywords: [] as string[],
    exclude_keywords: [] as string[],
    cv: null as { url: string; file_name: string; file_size?: number; uploaded_at?: string } | null,
    portfolio_urls: [] as string[],
  });

  const [newPortfolioUrl, setNewPortfolioUrl] = useState('');

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      // Convert old string locations to Location objects for backward compatibility
      const locations: Location[] = (profile.locations || []).map((loc: string) => {
        if (typeof loc === 'string') {
          return { display_name: loc };
        }
        return loc;
      });

      setFormData({
        skills: profile.skills || [],
        job_titles: profile.job_titles || [],
        locations,
        salary_min: profile.salary_min || '',
        salary_max: profile.salary_max || '',
        salary_currency: profile.salary_currency || 'USD',
        include_keywords: profile.include_keywords || [],
        exclude_keywords: profile.exclude_keywords || [],
        cv: (profile as any).cv || (profile.cv_url
          ? {
              url: profile.cv_url,
              file_name: 'CV.pdf', // Fallback for old data
              uploaded_at: new Date().toISOString(),
            }
          : null),
        portfolio_urls: profile.portfolio_urls || [],
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.put('/api/apply/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apply-profile'] });
      queryClient.invalidateQueries({ queryKey: ['apply-dashboard'] });
      setHasUnsavedChanges(false);
      showToast('Profile updated successfully', 'success');
    },
    onError: () => {
      showToast('Failed to update profile', 'error');
    },
  });

  // Calculate completion percentage
  const completion = {
    skills: formData.skills.length > 0,
    job_titles: formData.job_titles.length > 0,
    locations: formData.locations.length > 0,
    salary: formData.salary_min || formData.salary_max,
    keywords: formData.include_keywords.length > 0 || formData.exclude_keywords.length > 0,
    assets: formData.cv !== null || formData.portfolio_urls.length > 0,
  };

  const completionPercentage = Math.round(
    (Object.values(completion).filter(Boolean).length / Object.keys(completion).length) * 100
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert locations back to strings for API (backward compatibility)
    const locationsForApi = formData.locations.map(loc => loc.display_name);

    updateMutation.mutate({
      skills: formData.skills,
      job_titles: formData.job_titles,
      locations: locationsForApi,
      salary_min: formData.salary_min ? parseInt(String(formData.salary_min)) : undefined,
      salary_max: formData.salary_max ? parseInt(String(formData.salary_max)) : undefined,
      salary_currency: formData.salary_currency,
      include_keywords: formData.include_keywords,
      exclude_keywords: formData.exclude_keywords,
      portfolio_urls: formData.portfolio_urls,
    });
  };

  const addPortfolioUrl = () => {
    if (!newPortfolioUrl.trim()) return;
    
    try {
      new URL(newPortfolioUrl); // Validate URL
      if (!formData.portfolio_urls.includes(newPortfolioUrl)) {
        setFormData(prev => ({
          ...prev,
          portfolio_urls: [...prev.portfolio_urls, newPortfolioUrl],
        }));
        setNewPortfolioUrl('');
        setHasUnsavedChanges(true);
      }
    } catch {
      showToast('Invalid URL', 'error');
    }
  };

  const removePortfolioUrl = (index: number) => {
    setFormData(prev => ({
      ...prev,
      portfolio_urls: prev.portfolio_urls.filter((_, i) => i !== index),
    }));
    setHasUnsavedChanges(true);
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

  return (
    <>
      <Helmet>
        <title>Apply Profile - Talents Media</title>
      </Helmet>

      <Navbar />

      <div className="min-h-screen pt-24 pb-24 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/apply')}
              className="text-tm-text-muted hover:text-tm-text mb-4"
            >
              ← Back to Dashboard
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
                <p className="text-tm-text-muted">
                  Complete your profile to enable auto-apply
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-tm-primary-from">
                  {completionPercentage}%
                </div>
                <div className="text-sm text-tm-text-muted">Complete</div>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    className={cn(
                      'flex items-center gap-2 transition-colors',
                      currentStep === step.id && 'text-tm-primary-from'
                    )}
                  >
                    {completion[step.key as keyof typeof completion] ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                    <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        completion[step.key as keyof typeof completion]
                          ? 'bg-green-500'
                          : 'bg-tm-border'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Skills */}
            {currentStep === 1 && (
              <div className="glass-card p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">Skills</h2>
                  <p className="text-sm text-tm-text-muted">
                    Add 5-10 skills for best matching results
                  </p>
                </div>
                <AutocompleteInput
                  type="skill"
                  value={formData.skills}
                  onChange={skills => {
                    setFormData(prev => ({ ...prev, skills }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Search and add skills..."
                  maxItems={50}
                  profileContext={{
                    skills: formData.skills,
                    jobTitles: formData.job_titles,
                    includeKeywords: formData.include_keywords,
                    excludeKeywords: formData.exclude_keywords,
                    locations: formData.locations,
                  }}
                />
              </div>
            )}

            {/* Step 2: Job Titles */}
            {currentStep === 2 && (
              <div className="glass-card p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">Job Titles</h2>
                  <p className="text-sm text-tm-text-muted">
                    What positions are you looking for?
                  </p>
                </div>
                <AutocompleteInput
                  type="job_title"
                  value={formData.job_titles}
                  onChange={job_titles => {
                    setFormData(prev => ({ ...prev, job_titles }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Search and add job titles..."
                  maxItems={20}
                  profileContext={{
                    skills: formData.skills,
                    jobTitles: formData.job_titles,
                    includeKeywords: formData.include_keywords,
                    excludeKeywords: formData.exclude_keywords,
                    locations: formData.locations,
                  }}
                />
              </div>
            )}

            {/* Step 3: Locations */}
            {currentStep === 3 && (
              <div className="glass-card p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">Locations</h2>
                  <p className="text-sm text-tm-text-muted">
                    Where would you like to work?
                  </p>
                </div>
                <LocationPicker
                  value={formData.locations}
                  onChange={locations => {
                    setFormData(prev => ({ ...prev, locations }));
                    setHasUnsavedChanges(true);
                  }}
                  profileContext={{
                    selectedSkills: formData.skills,
                    selectedJobTitles: formData.job_titles,
                    includeKeywords: formData.include_keywords,
                    excludeKeywords: formData.exclude_keywords,
                    locations: formData.locations.map(loc => loc.display_name),
                  }}
                />
              </div>
            )}

            {/* Step 4: Salary Range */}
            {currentStep === 4 && (
              <div className="glass-card p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">Salary Range</h2>
                  <p className="text-sm text-tm-text-muted">
                    Your preferred salary range (optional)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Min Salary</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tm-text-muted" />
                      <input
                        type="number"
                        value={formData.salary_min}
                        onChange={e => {
                          setFormData(prev => ({ ...prev, salary_min: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="e.g., 50000"
                        className="w-full pl-10 pr-4 py-2 bg-tm-bg border border-tm-border rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Salary</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tm-text-muted" />
                      <input
                        type="number"
                        value={formData.salary_max}
                        onChange={e => {
                          setFormData(prev => ({ ...prev, salary_max: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="e.g., 100000"
                        className="w-full pl-10 pr-4 py-2 bg-tm-bg border border-tm-border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <select
                    value={formData.salary_currency}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, salary_currency: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-4 py-2 bg-tm-bg border border-tm-border rounded-lg"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JD">JD (د.ا)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 5: Keywords */}
            {currentStep === 5 && (
              <div className="glass-card p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">Keywords</h2>
                  <p className="text-sm text-tm-text-muted">
                    Include or exclude keywords from job descriptions
                  </p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-green-500">
                      Include Keywords
                    </label>
                    <AutocompleteInput
                      type="keyword"
                      value={formData.include_keywords}
                      onChange={include_keywords => {
                        setFormData(prev => ({ ...prev, include_keywords }));
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Keywords that should be in job descriptions..."
                      maxItems={30}
                      profileContext={{
                        skills: formData.skills,
                        jobTitles: formData.job_titles,
                        includeKeywords: formData.include_keywords,
                        excludeKeywords: formData.exclude_keywords,
                        locations: formData.locations,
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-red-500">
                      Exclude Keywords
                    </label>
                    <AutocompleteInput
                      type="keyword"
                      value={formData.exclude_keywords}
                      onChange={exclude_keywords => {
                        setFormData(prev => ({ ...prev, exclude_keywords }));
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Keywords that should NOT be in job descriptions..."
                      maxItems={30}
                      profileContext={{
                        skills: formData.skills,
                        jobTitles: formData.job_titles,
                        includeKeywords: formData.include_keywords,
                        excludeKeywords: formData.exclude_keywords,
                        locations: formData.locations,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: CV & Portfolio */}
            {currentStep === 6 && (
              <div className="glass-card p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">CV / Resume</h2>
                  <p className="text-sm text-tm-text-muted mb-4">
                    Upload your CV (PDF or DOCX, max 10MB)
                  </p>
                  <CVUploader
                    value={formData.cv}
                    onChange={cv => {
                      setFormData(prev => ({ ...prev, cv }));
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">Portfolio Links</h2>
                  <p className="text-sm text-tm-text-muted mb-4">
                    Add links to your portfolio, GitHub, LinkedIn, etc.
                  </p>
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tm-text-muted" />
                      <input
                        type="url"
                        value={newPortfolioUrl}
                        onChange={e => setNewPortfolioUrl(e.target.value)}
                        placeholder="https://example.com/portfolio"
                        className="w-full pl-10 pr-4 py-2 bg-tm-bg border border-tm-border rounded-lg"
                        onKeyPress={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addPortfolioUrl();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addPortfolioUrl}
                      className="px-4 py-2 bg-tm-primary-from text-white rounded-lg hover:brightness-110"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {formData.portfolio_urls.length > 0 && (
                    <div className="space-y-2">
                      {formData.portfolio_urls.map((url, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 bg-tm-bg/50 rounded"
                        >
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-sm text-tm-primary-from hover:underline truncate"
                          >
                            {url}
                          </a>
                          <button
                            type="button"
                            onClick={() => removePortfolioUrl(i)}
                            className="hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation & Save */}
            <div className="fixed bottom-0 left-0 right-0 bg-tm-card/95 backdrop-blur-xl border-t border-tm-border p-4 z-50">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex gap-2">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="px-4 py-2 border border-tm-border rounded-lg hover:bg-tm-bg/50"
                    >
                      Previous
                    </button>
                  )}
                  {currentStep < STEPS.length && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="px-4 py-2 bg-tm-primary-from/20 text-tm-primary-from rounded-lg hover:bg-tm-primary-from/30"
                    >
                      Next
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {hasUnsavedChanges && (
                    <span className="text-sm text-yellow-500">Unsaved changes</span>
                  )}
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-6 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
                  >
                    {updateMutation.isPending ? (
                      <LoadingSpinner />
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
