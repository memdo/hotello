import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Link, Navigate } from 'react-router-dom';
import { Calendar, MapPin, Users, CreditCard, Hotel, ChevronRight } from 'lucide-react';

export default function ReservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchReservations = async () => {
      setLoading(true);
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error("No access token found");

        const res = await fetch('/api/v1/hotels/reservations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error('Failed to fetch reservations');
        }

        const data = await res.json();
        setReservations(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [user?.id]);

  const handleCancel = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this reservation?")) return;
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/v1/hotels/reservations/${id}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to cancel reservation');
      }
      
      setReservations(reservations.map(r => 
        r.id === id ? { ...r, status: 'cancelled' } : r
      ));
      
    } catch (err) {
      alert(err.message);
    }
  };

  if (authLoading) return <div className="container" style={{ padding: '4rem 20px', textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/" />;

  return (
    <div className="container" style={{ padding: '4rem 20px' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Reservations</h1>
        <p style={{ color: 'var(--text-secondary)' }}>View and manage your hotel bookings</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading your reservations...</div>
      ) : error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: '8px' }}>
          {error}
        </div>
      ) : reservations.length === 0 ? (
        <div className="glass" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', marginBottom: '1.5rem' }}>
            <Calendar size={48} color="var(--text-secondary)" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No reservations yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Looks like you haven't booked any hotels yet.</p>
          <Link to="/explore" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            Explore Hotels <ChevronRight size={18} />
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {reservations.map(reservation => (
            <div key={reservation.id} className="glass hover-card" style={{ display: 'flex', borderRadius: '16px', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}>
              <div style={{ width: '250px', flexShrink: 0 }}>
                {reservation.hotels?.image_url ? (
                  <img src={reservation.hotels.image_url} alt={reservation.hotels?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Hotel size={48} color="var(--text-secondary)" />
                  </div>
                )}
              </div>
              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                      <Link to={`/hotel/${reservation.hotel_id}`} style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={e => e.target.style.color='var(--accent-blue)'} onMouseOut={e => e.target.style.color='inherit'}>
                        {reservation.hotels?.name || 'Unknown Hotel'}
                      </Link>
                    </h3>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '999px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      background: reservation.status === 'confirmed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: reservation.status === 'confirmed' ? 'var(--success)' : 'var(--danger)',
                      textTransform: 'uppercase'
                    }}>
                      {reservation.status}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    <MapPin size={16} /> {reservation.hotels?.city}, {reservation.hotels?.country}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Dates</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                        <Calendar size={16} color="var(--accent-blue)" /> 
                        {new Date(reservation.check_in).toLocaleDateString()} - {new Date(reservation.check_out).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Room</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                        <Hotel size={16} color="var(--accent-purple)" />
                        {reservation.room_types?.name || 'Standard Room'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Guests</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                        <Users size={16} color="#f97316" />
                        {reservation.guests} Guest{reservation.guests > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <div>
                    {reservation.status === 'confirmed' && (
                      <button 
                        onClick={() => handleCancel(reservation.id)}
                        className="btn-secondary" 
                        style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                        onMouseOver={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                        onMouseOut={(e) => { e.target.style.background = 'transparent'; }}
                      >
                        Cancel Reservation
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Price</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>
                      <CreditCard size={20} /> ${Math.round(reservation.total_price)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
