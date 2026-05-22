import React, { useState, useEffect } from 'react';
import HotelCard from '../components/search/HotelCard';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function ExplorePage() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { user } = useAuth();
  const limit = 10;

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true);
      try {
        const token = user ? (await supabase.auth.getSession()).data.session?.access_token : null;
        // Fetch all hotels with pagination, no city/date filters applied
        const res = await fetch(`/api/v1/hotels/search?page=${page}&limit=${limit}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await res.json();
        setHotels(data.hotels || []);
        
        if (data.pagination) {
            setTotalPages(Math.ceil(data.pagination.total / data.pagination.limit));
        }
      } catch (error) {
        console.error('Failed to fetch hotels', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHotels();
  }, [page, user?.id]);

  return (
    <div className="container" style={{ padding: '3rem 20px', minHeight: 'calc(100vh - 200px)' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Explore Destinations</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Discover our handpicked selection of premium hotels across the globe.</p>
      </div>
      
      {!user && (
        <div style={{ background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))', padding: '0.75rem', textAlign: 'center', fontWeight: 500, borderRadius: '8px', marginBottom: '2rem' }}>
          <span style={{ marginRight: '1rem' }}>🏷️ Log in to your account to unlock an exclusive 15% discount on all hotels!</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass" style={{ height: '350px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : hotels.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {hotels.map(hotel => <HotelCard key={hotel.id} hotel={hotel} />)}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '3rem' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  className="btn-secondary"
                  style={{ opacity: page === 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                    Page {page} of {totalPages}
                </div>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                  className="btn-secondary"
                  style={{ opacity: page === totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
            No hotels found.
        </div>
      )}
    </div>
  );
}
