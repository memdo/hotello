import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, Check, Tag } from 'lucide-react';
import { useAuth } from '../../lib/auth';

export default function HotelCard({ hotel }) {
  const { user } = useAuth();
  
  const [rating, setRating] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/v1/comments/ratings/${hotel.id}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data) {
           setRating({ 
             score: data.count > 0 ? parseFloat(data.overall) : null, 
             count: data.count 
           });
        }
      })
      .catch(e => console.error(e));
      
    return () => { isMounted = false; };
  }, [hotel.id]);

  return (
    <div className="glass" style={{ display: 'flex', overflow: 'hidden', padding: 0, marginBottom: '1.5rem', transition: 'transform 0.2s' }}>
      <div style={{ width: '300px', flexShrink: 0 }}>
        <img 
          src={hotel.image_url || `https://source.unsplash.com/featured/?hotel,${hotel.city.toLowerCase()}`} 
          alt={hotel.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      
      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{hotel.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <MapPin size={16} /> {hotel.city}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>
            <Star size={16} color="#fbbf24" fill="#fbbf24" /> {hotel.star_rating} Stars
          </div>
          {rating ? (
            rating.count > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>
                <span style={{ background: 'var(--success)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9rem' }}>{rating.score.toFixed(1)}</span>
                {rating.score >= 8.5 ? 'Exceptional' : rating.score >= 7 ? 'Good' : 'Average'} ({rating.count} reviews)
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                No reviews yet
              </div>
            )
          ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                <span style={{ opacity: 0.5 }}>Loading reviews...</span>
              </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'auto' }}>
          {hotel.amenities?.slice(0, 3).map(amenity => (
            <span key={amenity} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Check size={14} color="var(--success)" /> {amenity}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.5rem' }}>
          <div>
            {hotel.discounted && (
              <div style={{ color: 'var(--accent-purple)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                <Tag size={14} /> Member Price: 15% off
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              {hotel.discounted && (
                <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
                  ${(hotel.price_per_night / 0.85).toFixed(0)}
                </span>
              )}
              <span style={{ fontSize: '2rem', fontWeight: 700, color: hotel.discounted ? 'var(--accent-blue)' : 'white' }}>
                ${Math.round(hotel.price_per_night)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>/ night</span>
            </div>
          </div>
          
          <Link to={`/hotel/${hotel.id}`} className="btn-primary">
            Reserve Room
          </Link>
        </div>
      </div>
    </div>
  );
}
