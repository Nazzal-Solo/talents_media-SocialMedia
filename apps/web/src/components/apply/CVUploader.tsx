import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast-context';

interface CVData {
  url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  uploaded_at?: string;
}

interface CVUploaderProps {
  value?: CVData | null;
  onChange?: (cv: CVData | null) => void;
  className?: string;
}

export function CVUploader({ value, onChange, className }: CVUploaderProps) {
  // CV Uploader Component
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('cv', file);

      // Use axios directly for upload progress
      const axios = (await import('axios')).default;
      const authStorage = localStorage.getItem('auth-storage');
      let accessToken = '';
      if (authStorage) {
        try {
          const authData = JSON.parse(authStorage);
          accessToken = authData.state?.accessToken || '';
        } catch {}
      }

      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4002';
      
      const response = await axios.post(`${baseURL}/api/apply/cv/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
        },
        withCredentials: true,
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['apply-profile'] });
      queryClient.invalidateQueries({ queryKey: ['apply-dashboard'] });
      setUploadProgress(0);
      showToast('CV uploaded successfully', 'success');
      if (onChange) {
        onChange(data.cv);
      }
    },
    onError: (error: any) => {
      setUploadProgress(0);
      showToast(
        error?.response?.data?.error || 'Failed to upload CV',
        'error'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete('/api/apply/cv'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apply-profile'] });
      queryClient.invalidateQueries({ queryKey: ['apply-dashboard'] });
      showToast('CV deleted successfully', 'success');
      if (onChange) {
        onChange(null);
      }
    },
    onError: (error: any) => {
      showToast(
        error?.response?.data?.error || 'Failed to delete CV',
        'error'
      );
    },
  });

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      showToast('Only PDF and DOCX files are allowed', 'error');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB', 'error');
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const handleViewCV = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const authStorage = localStorage.getItem('auth-storage');
      let accessToken = '';
      if (authStorage) {
        try {
          const authData = JSON.parse(authStorage);
          accessToken = authData.state?.accessToken || '';
        } catch {}
      }

      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4002';
      const response = await fetch(`${baseURL}/api/apply/cv/view`, {
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch CV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      showToast('Failed to view CV', 'error');
    }
  };

  const handleDownloadCV = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!value) return;

    try {
      const authStorage = localStorage.getItem('auth-storage');
      let accessToken = '';
      if (authStorage) {
        try {
          const authData = JSON.parse(authStorage);
          accessToken = authData.state?.accessToken || '';
        } catch {}
      }

      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4002';
      const response = await fetch(`${baseURL}/api/apply/cv/download`, {
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download CV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = value.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast('Failed to download CV', 'error');
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {value ? (
        // CV exists - show info and delete option
        <div className="glass-card p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-tm-text-muted" />
                  <span className="font-medium truncate">{value.file_name}</span>
                </div>
                <div className="text-sm text-tm-text-muted space-y-1">
                  {value.file_size && (
                    <div>Size: {formatFileSize(value.file_size)}</div>
                  )}
                  {value.uploaded_at && (
                    <div>Uploaded: {formatDate(value.uploaded_at)}</div>
                  )}
                  {value.mime_type && (
                    <div className="inline-flex items-center gap-1">
                      <span className="text-xs px-2 py-0.5 bg-tm-primary-from/20 text-tm-primary-from rounded">
                        {value.mime_type === 'application/pdf' ? 'PDF' : 'DOCX'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={handleViewCV}
                    className="text-sm text-tm-primary-from hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    View CV
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCV}
                    className="text-sm text-tm-primary-from hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Download CV
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="p-2 text-red-500 hover:bg-red-500/20 rounded-lg transition disabled:opacity-50"
              aria-label="Delete CV"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      ) : (
        // No CV - show upload area
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragging
              ? 'border-tm-primary-from bg-tm-primary-from/10'
              : 'border-tm-border hover:border-tm-primary-from/50',
            uploadMutation.isPending && 'opacity-50 pointer-events-none'
          )}
        >
          {uploadMutation.isPending ? (
            <div className="space-y-3">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-tm-primary-from" />
              <div>
                <div className="text-sm font-medium mb-2">Uploading CV...</div>
                {uploadProgress > 0 && (
                  <div className="w-full bg-tm-bg rounded-full h-2">
                    <div
                      className="bg-tm-primary-from h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 mx-auto mb-4 text-tm-text-muted" />
              <div className="space-y-2">
                <div className="font-medium">
                  {isDragging ? 'Drop your CV here' : 'Upload your CV'}
                </div>
                <div className="text-sm text-tm-text-muted">
                  PDF or DOCX format, max 10MB
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition"
                >
                  Choose File
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelect(file);
          }
        }}
        className="hidden"
      />

      {uploadMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          <span>
            {uploadMutation.error
              ? (uploadMutation.error as any)?.response?.data?.error ||
                'Upload failed'
              : 'Upload failed'}
          </span>
        </div>
      )}
    </div>
  );
}

// Export as default as well for compatibility
export default CVUploader;
