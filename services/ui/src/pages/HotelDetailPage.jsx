import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Star, MapPin, Check, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CommentSection from '../components/hotel/CommentSection';

export default function HotelDetailPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingState, setBookingState] = useState({ checkIn: '', checkOut: '', guests: 2, roomTypeId: '', guestName: '', guestEmail: '' });
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    const fetchHotel = async () => {
      setLoading(true);
      try {
        const token = user ? (await supabase.auth.getSession()).data.session?.access_token : null;
        const res = await fetch(`/api/v1/hotels/${id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Failed to fetch hotel');
        const data = await res.json();
        setHotel(data);
      } catch (error) {
        console.error('Failed to fetch hotel', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHotel();
  }, [id, user?.id]);

  const handleBook = async (e) => {
    e.preventDefault();
    if (!user) {
        if (!bookingState.guestName || !bookingState.guestEmail) {
            alert("Please provide your name and email to book a room.");
            return;
        }
    } else if (!profile?.full_name) {
        alert("Please complete your profile details before reserving a room.");
        window.location.href = '/profile';
        return;
    }
    if (!bookingState.checkIn || !bookingState.checkOut) {
        alert("Please select check-in and check-out dates.");
        return;
    }
    if (bookingState.checkOut <= bookingState.checkIn) {
        alert("Check-out date must be after check-in date.");
        return;
    }
    if (!bookingState.roomTypeId) {
        alert("Please select a room type.");
        return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/v1/hotels/book', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          hotelId: id,
          ...bookingState
        })
      });

      if (res.ok) {
        setBookingSuccess(true);
      } else {
        const errData = await res.json();
        alert("Booking failed: " + (errData.error || 'Unknown error'));
      }
    } catch (err) {
      alert("Booking failed");
    }
  };

  if (loading) return <div className="container" style={{ padding: '4rem 20px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div>
      <div style={{ height: '400px', width: '100%', position: 'relative' }}>
        <img src={hotel.image_url} alt={hotel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3rem 0', background: 'linear-gradient(transparent, rgba(11,15,25,1))' }}>
          <div className="container">
            <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{hotel.name}</h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Star color="#fbbf24" fill="#fbbf24" size={20} /> {hotel.star_rating} Stars
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                <MapPin size={18} /> {hotel.city}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ display: 'flex', gap: '3rem', padding: '3rem 20px', alignItems: 'flex-start' }}>

        {/* Main Content */}
        <div style={{ flex: 2 }}>
          <section style={{ marginBottom: '3rem' }}>
            <h2>Overview</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.6 }}>
              {hotel.description}
            </p>
          </section>

          <section style={{ marginBottom: '3rem' }}>
            <h2>Amenities</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              {hotel.amenities.map(a => (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Check color="var(--success)" size={20} /> {a}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Available Rooms</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {hotel.room_types.map(rt => (
                <div key={rt.id} className="glass" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem' }}>{rt.name}</h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Up to {rt.capacity} guests</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: user ? 'var(--accent-blue)' : 'white' }}>
                      ${Math.round(rt.price_per_night)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>per night</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <CommentSection hotelId={id} />
        </div>

        {/* Booking Sidebar */}
        <div style={{ flex: 1, position: 'sticky', top: '100px' }}>
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Reserve Your Stay</h3>

            {bookingSuccess ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', padding: '1rem', borderRadius: '8px', color: 'var(--success)' }}>
                Booking confirmed! We've sent a confirmation email to you.
              </div>
            ) : (
              <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!user && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Full Name</label>
                      <input type="text" value={bookingState.guestName} onChange={e => setBookingState({...bookingState, guestName: e.target.value})} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email</label>
                      <input type="email" value={bookingState.guestEmail} onChange={e => setBookingState({...bookingState, guestEmail: e.target.value})} required />
                    </div>
                  </>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Check In</label>
                  <input type="date" value={bookingState.checkIn} onChange={e => setBookingState({...bookingState, checkIn: e.target.value})} required min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Check Out</label>
                  <input type="date" value={bookingState.checkOut} onChange={e => setBookingState({...bookingState, checkOut: e.target.value})} required min={bookingState.checkIn || new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Guests</label>
                  <input type="number" min="1" value={bookingState.guests} onChange={e => setBookingState({ ...bookingState, guests: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Room Type</label>
                  <select value={bookingState.roomTypeId} onChange={e => setBookingState({ ...bookingState, roomTypeId: e.target.value })} required>
                    <option value="">Select a room...</option>
                    {hotel.room_types.map(rt => (
                      <option key={rt.id} value={rt.id}>{rt.name} - ${Math.round(rt.price_per_night)}/night</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn-primary" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  Confirm Booking <ChevronRight size={18} />
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
