import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/search/SearchBar';
import HotelCard from '../components/search/HotelCard';
import MapView from '../components/search/MapView';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true);
      try {
        const token = user ? (await supabase.auth.getSession()).data.session?.access_token : null;
        const res = await fetch(`/api/v1/hotels/search?${searchParams.toString()}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await res.json();
        setHotels(data.hotels || []);
      } catch (error) {
        console.error('Failed to fetch hotels', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHotels();
  }, [searchParams, user?.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 73px)' }}>
      <div style={{ background: 'var(--surface-color-light)', padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <SearchBar />
        </div>
      </div>
      
      {!user && (
        <div style={{ background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))', padding: '0.75rem', textAlign: 'center', fontWeight: 500 }}>
          <span style={{ marginRight: '1rem' }}>🏷️ Log in to your account to unlock an exclusive 15% discount on all hotels!</span>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: '1', padding: '2rem', overflowY: 'auto' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>
            {loading ? 'Searching...' : `${hotels.length} properties found`}
          </h2>
          
          {loading ? (
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              {[1, 2].map(i => (
                <div key={i} className="glass" style={{ height: '200px', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : (
            hotels.map(hotel => <HotelCard key={hotel.id} hotel={hotel} />)
          )}
        </div>
        
        <div style={{ width: '40%', borderLeft: '1px solid var(--border)' }}>
          {!loading && <MapView hotels={hotels} />}
        </div>
      </div>
    </div>
  );
}
