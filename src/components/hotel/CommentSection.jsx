import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Star, MessageSquare, Plus, Check } from 'lucide-react';

export default function CommentSection({ hotelId }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [averages, setAverages] = useState({ overall: 0, cleanliness: 0, staff: 0, facilities: 0, location: 0, comfort: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Ratings state for new review
  const [review, setReview] = useState({
    ratingOverall: 10,
    ratingCleanliness: 10,
    ratingStaff: 10,
    ratingFacilities: 10,
    ratingLocation: 10,
    ratingComfort: 10,
    commentText: ''
  });

  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/comments/${hotelId}?page=${pagination.page}&limit=${pagination.limit}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      const data = await res.json();
      const loadedComments = data.comments || [];
      setComments(loadedComments);
      setPagination(prev => ({ ...prev, total: data.pagination.total }));

      // Calculate averages for the visual graph representation
      const total = loadedComments.length;
      if (total > 0) {
         const sums = loadedComments.reduce((acc, curr) => {
             acc.overall += curr.rating_overall || 0;
             acc.cleanliness += curr.rating_cleanliness || 0;
             acc.staff += curr.rating_staff || 0;
             acc.facilities += curr.rating_facilities || 0;
             acc.location += curr.rating_location || 0;
             acc.comfort += curr.rating_comfort || 0;
             return acc;
         }, { overall: 0, cleanliness: 0, staff: 0, facilities: 0, location: 0, comfort: 0 });

         setAverages({
             overall: (sums.overall / total).toFixed(1),
             cleanliness: (sums.cleanliness / total).toFixed(1),
             staff: (sums.staff / total).toFixed(1),
             facilities: (sums.facilities / total).toFixed(1),
             location: (sums.location / total).toFixed(1),
             comfort: (sums.comfort / total).toFixed(1)
         });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [hotelId, pagination.page]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
        alert("Please log in to submit a comment.");
        return;
    }
    if (!profile?.full_name) {
        alert("Please complete your profile setup before writing reviews!");
        window.location.href = '/profile';
        return;
    }

    setSubmitting(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/v1/comments/${hotelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(review)
      });

      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to submit review');
      }

      setSuccess(true);
      setReview({
        ratingOverall: 10,
        ratingCleanliness: 10,
        ratingStaff: 10,
        ratingFacilities: 10,
        ratingLocation: 10,
        ratingComfort: 10,
        commentText: ''
      });
      fetchComments();
      setTimeout(() => setSuccess(false), 3000);
    } catch(err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to render overall rating badge with matching colors
  const getRatingBadgeClass = (rating) => {
    if (rating >= 8) return { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid var(--success)' };
    if (rating >= 5) return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b' };
    return { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' };
  };

  return (
    <div style={{ marginTop: '4rem', borderTop: '1px solid var(--border)', paddingTop: '3rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <MessageSquare color="var(--accent-blue)" /> Guest Reviews ({pagination.total})
      </h2>

      {/* Ratings distribution bar graph */}
      {comments.length > 0 && (
        <div className="glass" style={{ padding: '2rem', marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', borderRight: '1px solid var(--border)', paddingRight: '2rem' }}>
             <div style={{ fontSize: '4.5rem', fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1 }}>{averages.overall}</div>
             <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.5rem' }}>Out of 10</div>
             <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Overall Guest Rating</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             {[
               { name: 'Cleanliness', score: averages.cleanliness },
               { name: 'Staff', score: averages.staff },
               { name: 'Facilities', score: averages.facilities },
               { name: 'Location', score: averages.location },
               { name: 'Comfort', score: averages.comfort }
             ].map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '100px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{cat.name}</div>
                  <div style={{ flex: 1, height: '8px', background: 'var(--surface-color-light)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                     <div style={{ width: `${cat.score * 10}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))', borderRadius: '4px', transition: 'width 1s ease-in-out' }}></div>
                  </div>
                  <div style={{ width: '35px', textAlign: 'right', fontSize: '0.9rem', fontWeight: 600 }}>{cat.score}</div>
                </div>
             ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem', alignItems: 'flex-start' }}>
        
        {/* Left Side: Reviews List */}
        <div>
          {loading && comments.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading reviews...</div>
          ) : comments.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              No reviews yet. Be the first to leave a review!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {comments.map((c) => {
                const badge = getRatingBadgeClass(c.rating_overall);
                return (
                  <div key={c.id} className="glass" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-color-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {c.user_profiles?.avatar_url ? (
                        <img src={c.user_profiles.avatar_url} alt="Reviewer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {(c.user_profiles?.full_name || 'A')[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem' }}>{c.user_profiles?.full_name || 'Anonymous User'}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 700, ...badge }}>
                          {c.rating_overall}/10
                        </div>
                      </div>

                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.5rem 0', lineHeight: 1.5 }}>
                        {c.comment_text}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span style={{ background: 'var(--surface-color-light)', padding: '2px 8px', borderRadius: '4px' }}>Cleanliness: {c.rating_cleanliness}</span>
                        <span style={{ background: 'var(--surface-color-light)', padding: '2px 8px', borderRadius: '4px' }}>Staff: {c.rating_staff}</span>
                        <span style={{ background: 'var(--surface-color-light)', padding: '2px 8px', borderRadius: '4px' }}>Facilities: {c.rating_facilities}</span>
                        <span style={{ background: 'var(--surface-color-light)', padding: '2px 8px', borderRadius: '4px' }}>Location: {c.rating_location}</span>
                        <span style={{ background: 'var(--surface-color-light)', padding: '2px 8px', borderRadius: '4px' }}>Comfort: {c.rating_comfort}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Submit Review Form */}
        <div>
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Leave a Review</h3>

            {!user ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                Please log in to submit a review and rate this hotel.
              </div>
            ) : !profile?.full_name ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                <p>Please set up your profile details first to submit a review.</p>
                <a href="/profile" className="btn-primary" style={{ display: 'block', textDecoration: 'none', padding: '8px', fontSize: '0.9rem', marginTop: '1rem' }}>
                    Complete Profile
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {success && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Check size={16} /> Review submitted!
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Overall Experience (1-10)</label>
                  <input type="number" min="1" max="10" value={review.ratingOverall} onChange={e => setReview({...review, ratingOverall: parseInt(e.target.value)})} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Cleanliness</label>
                    <input type="number" min="1" max="10" value={review.ratingCleanliness} onChange={e => setReview({...review, ratingCleanliness: parseInt(e.target.value)})} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Staff</label>
                    <input type="number" min="1" max="10" value={review.ratingStaff} onChange={e => setReview({...review, ratingStaff: parseInt(e.target.value)})} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Facilities</label>
                    <input type="number" min="1" max="10" value={review.ratingFacilities} onChange={e => setReview({...review, ratingFacilities: parseInt(e.target.value)})} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Location</label>
                    <input type="number" min="1" max="10" value={review.ratingLocation} onChange={e => setReview({...review, ratingLocation: parseInt(e.target.value)})} required />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Comfort (1-10)</label>
                  <input type="number" min="1" max="10" value={review.ratingComfort} onChange={e => setReview({...review, ratingComfort: parseInt(e.target.value)})} required />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Your Comments</label>
                  <textarea 
                    value={review.commentText} 
                    onChange={e => setReview({...review, commentText: e.target.value})} 
                    placeholder="Write details about your stay..."
                    rows={4}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.9rem' }}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Post Review'}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
