import React from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/search/SearchBar';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero Section */}
      <section style={{ 
        position: 'relative', 
        padding: '5rem 0', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '450px',
        zIndex: 10
      }}>
        {/* Background Image with Overlay */}
        <div style={{ 
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundImage: 'url("https://images.unsplash.com/photo-1542314831-c6a4d142104d?q=80&w=2000&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: -2
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, rgba(11, 15, 25, 0.4), rgba(11, 15, 25, 0.95))',
          zIndex: -1
        }} />

        <div className="container" style={{ width: '100%' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.1, color: '#ffffff' }}>
              Find Your Perfect <span style={{ color: 'var(--accent-primary)' }}>Stay</span>
            </h1>
            <p style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '3rem' }}>
              Book premium hotels worldwide. Enjoy exclusive discounts and AI-powered recommendations.
            </p>
            
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Featured Destinations */}
      <section style={{ padding: '2rem 0 5rem' }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Featured Destinations</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {['Rome', 'Paris', 'Tokyo', 'New York', 'Istanbul', 'Los Angeles'].map((city, i) => {
              const cityImages = {
                'Rome': 'rome.jpg',
                'Paris': 'paris.jpg',
                'Tokyo': 'tokyo.jpg',
                'New York': 'ny.jpg',
                'Istanbul': 'istanbul.jpg',
                'Los Angeles': 'la.jpg'
              };
              const bucketUrl = 'https://puvlkcksegmxvokalikk.supabase.co/storage/v1/object/public/hotel-images/';
              return (
              <div 
                key={city} 
                className="glass hover-card" 
                onClick={() => navigate(`/search?city=${encodeURIComponent(city)}`)}
                style={{ overflow: 'hidden', cursor: 'pointer', padding: 0 }}
              >
                <img 
                  src={`${bucketUrl}${cityImages[city]}`} 
                  alt={city}
                  style={{ width: '100%', height: '200px', objectFit: 'cover' }} 
                />
                <div style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{city}</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>Explore properties →</p>
                </div>
              </div>
            )})}
          </div>
        </div>
      </section>
    </div>
  );
}
