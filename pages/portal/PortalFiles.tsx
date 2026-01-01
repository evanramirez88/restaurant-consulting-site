import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  FolderOpen,
  File,
  FileText,
  FileImage,
  FileVideo,
  Download,
  Search,
  Grid,
  List,
  ExternalLink,
  Folder,
  ChevronRight
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  category: string;
  description: string | null;
  url: string;
  google_drive_file_id: string | null;
  created_at: number;
  updated_at: number;
}

interface FileCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  count: number;
}

// ============================================
// PORTAL FILES PAGE
// ============================================
const PortalFiles: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useSEO({
    title: 'Files | Client Portal',
    description: 'Access your documents, training materials, and files.',
  });

  // Load files
  useEffect(() => {
    const loadFiles = async () => {
      if (!slug) return;

      try {
        const response = await fetch(`/api/portal/${slug}/files`);
        const data = await response.json();

        if (data.success) {
          setFiles(data.data || []);
        } else {
          setError(data.error || 'Failed to load files');
        }
      } catch (err) {
        console.error('Files load error:', err);
        setError('Failed to load files');
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();
  }, [slug]);

  // Utility functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage className="w-6 h-6 text-purple-400" />;
    if (type.startsWith('video/')) return <FileVideo className="w-6 h-6 text-red-400" />;
    if (type.includes('pdf')) return <FileText className="w-6 h-6 text-red-400" />;
    if (type.includes('document') || type.includes('word')) return <FileText className="w-6 h-6 text-blue-400" />;
    if (type.includes('sheet') || type.includes('excel')) return <FileText className="w-6 h-6 text-green-400" />;
    return <File className="w-6 h-6 text-gray-400" />;
  };

  const getFileExtension = (name: string) => {
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  };

  // Build categories from files
  const categories: FileCategory[] = [
    { id: 'all', name: 'All Files', description: 'View all documents', icon: <FolderOpen className="w-5 h-5" />, count: files.length },
    { id: 'training', name: 'Training', description: 'Training materials and guides', icon: <Folder className="w-5 h-5 text-blue-400" />, count: files.filter(f => f.category === 'training').length },
    { id: 'sops', name: 'SOPs', description: 'Standard Operating Procedures', icon: <Folder className="w-5 h-5 text-green-400" />, count: files.filter(f => f.category === 'sops').length },
    { id: 'contracts', name: 'Contracts', description: 'Agreements and contracts', icon: <Folder className="w-5 h-5 text-amber-400" />, count: files.filter(f => f.category === 'contracts').length },
    { id: 'invoices', name: 'Invoices', description: 'Billing and invoices', icon: <Folder className="w-5 h-5 text-purple-400" />, count: files.filter(f => f.category === 'invoices').length },
    { id: 'other', name: 'Other', description: 'Miscellaneous files', icon: <Folder className="w-5 h-5 text-gray-400" />, count: files.filter(f => !['training', 'sops', 'contracts', 'invoices'].includes(f.category)).length },
  ];

  // Filter files
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.description && file.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || selectedCategory === 'all' || file.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Files</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Files</h1>
          <p className="text-gray-400">Access your documents, training materials, and files</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id === 'all' ? null : category.id)}
            className={`admin-card p-4 text-left hover:border-amber-500/30 transition-all ${
              (selectedCategory === category.id) || (!selectedCategory && category.id === 'all')
                ? 'border-amber-500/50 bg-amber-500/5'
                : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {category.icon}
              <span className="text-sm font-medium text-white">{category.name}</span>
            </div>
            <p className="text-xs text-gray-500">{category.count} files</p>
          </button>
        ))}
      </div>

      {/* Files Grid/List */}
      {filteredFiles.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Files Found</h3>
          <p className="text-gray-400">
            {searchQuery
              ? 'No files match your search criteria.'
              : 'Your files will appear here once uploaded.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="admin-card p-4 hover:border-amber-500/30 transition-all group"
            >
              {/* File Preview/Icon */}
              <div className="aspect-square bg-gray-900/50 rounded-lg flex items-center justify-center mb-4 relative">
                <div className="text-center">
                  {getFileIcon(file.type)}
                  <span className="block text-xs text-gray-500 mt-2">{getFileExtension(file.name)}</span>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-gray-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                  <a
                    href={file.url}
                    download
                    className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/* File Info */}
              <h4 className="text-sm font-medium text-white truncate mb-1" title={file.name}>
                {file.name}
              </h4>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatFileSize(file.size)}</span>
                <span>{formatDate(file.created_at)}</span>
              </div>

              {/* Google Drive Indicator */}
              {file.google_drive_file_id && (
                <div className="mt-2 flex items-center gap-1 text-xs text-blue-400">
                  <ExternalLink className="w-3 h-3" />
                  <span>Google Drive</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="admin-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left">
                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Category</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Size</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{file.name}</p>
                        {file.description && (
                          <p className="text-xs text-gray-500 truncate">{file.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="text-sm text-gray-400 capitalize">{file.category}</span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-400">{formatFileSize(file.size)}</span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-400">{formatDate(file.created_at)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                        title="Open"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a
                        href={file.url}
                        download
                        className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Google Drive Integration Notice */}
      <div className="admin-card p-6 border-l-4 border-l-blue-500">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <ExternalLink className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="font-medium text-white mb-1">Google Drive Integration</h4>
            <p className="text-sm text-gray-400">
              Files marked with the Google Drive icon are synced from your shared folder.
              Contact support to set up your Google Drive folder for automatic file syncing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalFiles;
