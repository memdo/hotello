import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';
import { MessageSquare, MapPin, ChevronRight, Star } from 'lucide-react';

export default function CommentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [comments, setComments] = useState([]);
  const [hotels, setHotels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchComments = async () => {
      setLoading(true);
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error("No access token found");

        const res = await fetch('/api/v1/comments/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error('Failed to fetch comments');
        const data = await res.json();
        
        // Fetch hotel names for the comments
        const uniqueHotelIds = [...new Set(data.map(c => c.hotel_id))];
        const hotelData = {};
        
        await Promise.all(uniqueHotelIds.map(async (id) => {
          try {
            const hRes = await fetch(`/api/v1/hotels/${id}`);
            if (hRes.ok) {
              hotelData[id] = await hRes.json();
            }
          } catch(e) {}
        }));
        
        setHotels(hotelData);
        setComments(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [user?.id]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/v1/comments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete comment');
      }
      
      setComments(comments.filter(c => c._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  if (authLoading) return <div className="container" style={{ padding: '4rem 20px', textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/" />;

  return (
    <div className="container" style={{ padding: '4rem 20px' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Comments</h1>
        <p style={{ color: 'var(--text-secondary)' }}>View and manage your hotel reviews</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading your comments...</div>
      ) : error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      ) : comments.length === 0 ? (
        <div className="glass" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <MessageSquare size={48} color="var(--text-secondary)" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No reviews yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Share your experiences by reviewing hotels you've visited.</p>
          <Link to="/explore" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            Explore Hotels <ChevronRight size={18} />
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {comments.map(comment => {
            const hotel = hotels[comment.hotel_id];
            
            return (
              <div key={comment._id} className="glass hover-card" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      <Link to={`/hotel/${comment.hotel_id}`} style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={e => e.target.style.color='var(--accent-blue)'} onMouseOut={e => e.target.style.color='inherit'}>
                        {hotel?.name || 'Unknown Hotel'}
                      </Link>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <MapPin size={16} /> {hotel?.city || 'Unknown Location'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{comment.rating_overall}</span>
                    <Star size={18} color="var(--success)" fill="var(--success)" />
                  </div>
                </div>
                
                <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginTop: '0.5rem', fontStyle: 'italic' }}>
                  "{comment.comment_text}"
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cleanliness</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{comment.rating_cleanliness}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Staff</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{comment.rating_staff}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Facilities</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{comment.rating_facilities}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Location</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{comment.rating_location}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Comfort</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{comment.rating_comfort}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Posted on {new Date(comment.created_at).toLocaleDateString()}
                  </div>
                  <button 
                    onClick={() => handleDelete(comment._id)}
                    className="btn-secondary" 
                    style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent', padding: '6px 12px', fontSize: '0.85rem' }}
                    onMouseOver={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                    onMouseOut={(e) => { e.target.style.background = 'transparent'; }}
                  >
                    Delete Review
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
