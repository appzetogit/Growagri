import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiStar,
  FiFilter,
  FiTrash2,
  FiSearch,
  FiUser,
  FiBriefcase,
  FiBox
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import reviewService from '../../services/reviewService';
import CardShell from '../UserCategories/components/CardShell';

const ReviewsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    rating: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1
  });

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await reviewService.getAllReviews(filters);
      if (response.success) {
        setReviews(response.data);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Fetch reviews error:', error);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [filters]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      const response = await reviewService.updateReviewStatus(id, 'deleted');
      if (response.success) {
        toast.success('Review deleted');
        fetchReviews();
      }
    } catch (error) {
      console.error('Delete review error:', error);
      toast.error('Failed to delete review');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <FiStar
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
              }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <CardShell className="bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-gray-700 mb-1 ml-1">Rating</label>
            <select
              value={filters.rating}
              onChange={(e) => setFilters({ ...filters, rating: e.target.value, page: 1 })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>
      </CardShell>

      {/* Reviews Table */}
      <CardShell className="bg-white overflow-hidden p-0 border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Farmer</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Feedback</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Vendor / Equipment</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Booking ID</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2 text-xs font-medium">Loading reviews...</p>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    <FiSearch className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-base font-medium">No reviews found</p>
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 text-xs font-bold border border-primary-100">
                          {review.userId?.name?.charAt(0) || <FiUser />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{review.userId?.name || 'Deleted User'}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{review.userId?.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="space-y-1">
                        {renderStars(review.rating)}
                        <p className="text-slate-700 text-xs leading-snug line-clamp-2">{review.review}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                          {new Date(review.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <FiBriefcase className="text-slate-400 w-3 h-3" />
                          <span className="font-bold text-slate-700">{review.vendorId?.name || review.vendorId?.businessName || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <FiBox className="text-slate-400 w-3 h-3" />
                          <span className="text-slate-600">{review.bookingId?.serviceName || review.serviceId?.title || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {review.bookingId?.bookingNumber ? `#${review.bookingId.bookingNumber}` : 'N/A'}
                      </span>
                      {review.status === 'hidden' && (
                        <span className="block mt-1 text-[9px] font-bold uppercase text-amber-600">Hidden</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(review._id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Review"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-1.5">
              <button
                disabled={pagination.page === 1}
                onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-all shadow-sm"
              >
                Previous
              </button>
              <button
                disabled={pagination.page === pagination.pages}
                onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary-600 text-white disabled:opacity-40 hover:bg-primary-700 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </CardShell>
    </div>
  );
};

export default ReviewsPage;
