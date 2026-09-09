import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { AdminNavbar, AdminFooter } from '../../components/AdminNavbar';
import type { ExamStatus } from '@nqt/shared';

interface AdminExamItem {
  id: string;
  title: string;
  description: string | null;
  status: ExamStatus;
  version: number;
  locked: boolean;
  createdAt: string;
  question_counts: {
    section1: number;
    section2: number;
    section3: number;
  };
  attempt_count: number;
}

export const ExamsList: React.FC = () => {
  const [exams, setExams] = useState<AdminExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchExams = async () => {
    try {
      const res = await api.get<AdminExamItem[]>('/admin/exams');
      setExams(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load exams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleStatusChange = async (id: string, newStatus: ExamStatus) => {
    setActionLoading(id);
    try {
      await api.patch(`/admin/exams/${id}/status`, { status: newStatus });
      await fetchExams();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update exam status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.post(`/admin/exams/${id}/duplicate`);
      navigate(`/admin/exams/${res.data.exam.id}/edit`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to duplicate exam.');
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this draft exam?')) return;
    setActionLoading(id);
    try {
      await api.delete(`/admin/exams/${id}`);
      await fetchExams();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete exam.');
    } finally {
      setActionLoading(null);
    }
  };

  const activeCount = exams.filter((e) => e.status === 'active').length;
  const draftCount = exams.filter((e) => e.status === 'draft').length;
  const archivedCount = exams.filter((e) => e.status === 'archived').length;

  const filteredExams = exams.filter((exam) => {
    const matchesFilter =
      filter === 'all' ? true : exam.status === filter;
    const matchesSearch =
      searchQuery.trim() === '' ||
      exam.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-surface-canvas text-text-primary font-body-default min-h-screen flex flex-col antialiased">
      <AdminNavbar />

      <main className="flex-grow w-full max-w-candidate-max-width mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="font-headline-md text-headline-md text-text-primary">Exams</h1>
            <p className="text-text-muted mt-1">Create and manage examination content, access status, and versioning.</p>
          </div>
          <Link
            to="/admin/exams/new"
            className="bg-primary-container text-on-primary font-label-prominent text-label-prominent px-5 py-2.5 rounded hover:bg-[#172554] active:bg-text-primary transition-colors duration-100 flex items-center space-x-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Exam</span>
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-4 md:space-y-0">
          <div className="flex space-x-6 border-b border-border-rule w-full md:w-auto">
            <button
              onClick={() => setFilter('all')}
              className={`pb-3 font-label-prominent text-label-prominent transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All ({exams.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`pb-3 font-label-prominent text-label-prominent transition-colors cursor-pointer ${
                filter === 'active'
                  ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('draft')}
              className={`pb-3 font-label-prominent text-label-prominent transition-colors cursor-pointer ${
                filter === 'draft'
                  ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Draft ({draftCount})
            </button>
            <button
              onClick={() => setFilter('archived')}
              className={`pb-3 font-label-prominent text-label-prominent transition-colors cursor-pointer ${
                filter === 'archived'
                  ? 'text-primary-container border-b-2 border-primary-container font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Archived ({archivedCount})
            </button>
          </div>
          <div className="relative w-full md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border-rule rounded bg-surface-card text-text-primary font-body-default placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow duration-100"
              placeholder="Search exams..."
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-card border border-border-rule rounded overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-muted font-body-default">
              Loading assessments...
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="p-12 text-center text-text-muted font-body-default">
              No assessments found matching the criteria.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-canvas border-b border-border-rule">
                  <th className="py-3 px-4 font-label-prominent text-label-prominent text-text-muted font-semibold">Assessment Name</th>
                  <th className="py-3 px-4 font-label-prominent text-label-prominent text-text-muted font-semibold">Version</th>
                  <th className="py-3 px-4 font-label-prominent text-label-prominent text-text-muted font-semibold">Status</th>
                  <th className="py-3 px-4 font-label-prominent text-label-prominent text-text-muted font-semibold text-right">Candidates</th>
                  <th className="py-3 px-4 font-label-prominent text-label-prominent text-text-muted font-semibold text-right">Created Date</th>
                  <th className="py-3 px-4 font-label-prominent text-label-prominent text-text-muted font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-rule">
                {filteredExams.map((exam) => (
                  <tr
                    key={exam.id}
                    className="bg-surface-card hover:bg-[#F1F5F9] transition-colors duration-100 h-[44px]"
                  >
                    <td className="py-2 px-4 font-body-default text-text-primary">
                      {exam.title}
                    </td>
                    <td className="py-2 px-4 font-label-mono text-label-mono text-text-muted">
                      v{exam.version}
                    </td>
                    <td className="py-2 px-4">
                      {exam.status === 'active' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#DCFCE7] text-state-success">
                          Active
                        </span>
                      ) : exam.status === 'draft' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F1F5F9] text-text-muted border border-border-rule">
                          Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F1F5F9] text-text-muted border border-border-rule">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 font-label-mono text-label-mono text-text-muted text-right">
                      {exam.attempt_count}
                    </td>
                    <td className="py-2 px-4 font-label-mono text-label-mono text-text-muted text-right">
                      {new Date(exam.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2 px-4 text-right space-x-3 whitespace-nowrap">
                      {exam.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(exam.id, 'active')}
                            disabled={actionLoading === exam.id}
                            className="text-primary-container font-label-prominent text-label-prominent font-medium hover:text-[#172554] transition-colors duration-100 cursor-pointer disabled:opacity-50"
                          >
                            Publish
                          </button>
                          <Link
                            to={`/admin/exams/${exam.id}/edit`}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100"
                          >
                            Edit Content
                          </Link>
                          <button
                            onClick={() => handleDuplicate(exam.id)}
                            disabled={actionLoading === exam.id}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100 cursor-pointer disabled:opacity-50"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleDelete(exam.id)}
                            disabled={actionLoading === exam.id}
                            className="text-timer-critical hover:text-[#991B1B] font-label-prominent text-label-prominent transition-colors duration-100 cursor-pointer disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}

                      {exam.status === 'active' && (
                        <>
                          <Link
                            to={`/admin/exams/${exam.id}/edit`}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100"
                          >
                            Edit Content
                          </Link>
                          <button
                            onClick={() => handleDuplicate(exam.id)}
                            disabled={actionLoading === exam.id}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100 cursor-pointer disabled:opacity-50"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleStatusChange(exam.id, 'archived')}
                            disabled={actionLoading === exam.id}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100 cursor-pointer disabled:opacity-50"
                          >
                            Archive
                          </button>
                          <Link
                            to={`/admin/attempts?examId=${exam.id}`}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100"
                          >
                            View Attempts
                          </Link>
                        </>
                      )}

                      {exam.status === 'archived' && (
                        <>
                          <button
                            onClick={() => handleDuplicate(exam.id)}
                            disabled={actionLoading === exam.id}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100 cursor-pointer disabled:opacity-50"
                          >
                            Duplicate
                          </button>
                          <Link
                            to={`/admin/attempts?examId=${exam.id}`}
                            className="text-text-muted hover:text-text-primary font-label-prominent text-label-prominent transition-colors duration-100"
                          >
                            View Attempts
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <span className="text-text-muted font-body-compact text-body-compact">
            Showing 1 to {filteredExams.length} of {exams.length} assessments
          </span>
          <div className="flex space-x-2">
            <button
              className="px-3 py-1.5 border border-border-rule rounded bg-surface-card text-text-muted font-label-prominent text-label-prominent cursor-not-allowed opacity-50"
              disabled
            >
              Previous
            </button>
            <button
              className="px-3 py-1.5 border border-border-rule rounded bg-surface-card text-text-muted font-label-prominent text-label-prominent cursor-not-allowed opacity-50"
              disabled
            >
              Next
            </button>
          </div>
        </div>
      </main>

      <AdminFooter />
    </div>
  );
};
