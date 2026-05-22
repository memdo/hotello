import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { Building, Plus, Calendar, List, CheckCircle, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('rooms');
  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add Room form state
  const [newRoomName, setNewRoomName] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newTotalRooms, setNewTotalRooms] = useState('');
  const [roomActionLoading, setRoomActionLoading] = useState(false);

  // Set Availability form state
  const [availRoomTypeId, setAvailRoomTypeId] = useState('');
  const [availStartDate, setAvailStartDate] = useState('');
  const [availEndDate, setAvailEndDate] = useState('');
  const [availStatus, setAvailStatus] = useState('true');
  const [availCount, setAvailCount] = useState('');
  const [availActionLoading, setAvailActionLoading] = useState(false);

  // General alert feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdminData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, isAdmin, authLoading]);

  async function fetchAdminData() {
    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Fetch Hotel owned by admin
      const { data: hotels, error: hotelError } = await supabase
        .from('hotels')
        .select('*')
        .eq('admin_id', user.id);

      if (hotelError) throw hotelError;

      if (hotels && hotels.length > 0) {
        const activeHotel = hotels[0];
        setHotel(activeHotel);

        // 2. Fetch Room Types for this hotel
        const { data: roomTypes, error: roomsError } = await supabase
          .from('room_types')
          .select('*')
          .eq('hotel_id', activeHotel.id)
          .order('created_at', { ascending: true });

        if (roomsError) throw roomsError;
        setRooms(roomTypes || []);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setErrorMsg('Failed to load hotel dashboard.');
    } finally {
      setLoading(false);
    }
  }

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!hotel) return;

    setRoomActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/v1/hotels/admin/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelId: hotel.id,
          name: newRoomName,
          capacity: parseInt(newCapacity),
          pricePerNight: parseFloat(newPrice),
          totalRooms: parseInt(newTotalRooms)
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to add room type.');

      setSuccessMsg(`Successfully added room type: ${newRoomName}`);
      setNewRoomName('');
      setNewCapacity('');
      setNewPrice('');
      setNewTotalRooms('');
      
      // Refresh list
      await fetchAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred while saving room type.');
    } finally {
      setRoomActionLoading(false);
    }
  };

  const handleUpdateAvailability = async (e) => {
    e.preventDefault();
    if (!availRoomTypeId || !availStartDate || !availEndDate) {
      setErrorMsg('Please select a room type and dates.');
      return;
    }

    setAvailActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const selectedRoom = rooms.find(r => r.id === availRoomTypeId);
      const capCount = availCount ? parseInt(availCount) : selectedRoom?.total_rooms;

      const response = await fetch('/api/v1/hotels/admin/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          roomTypeId: availRoomTypeId,
          startDate: availStartDate,
          endDate: availEndDate,
          isAvailable: availStatus === 'true',
          availableCount: capCount
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update availability calendar.');

      setSuccessMsg(`Successfully updated availability calendar slots (${resData.count} days).`);
      setAvailStartDate('');
      setAvailEndDate('');
      setAvailCount('');
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred while saving availability slots.');
    } finally {
      setAvailActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container" style={{ padding: '8rem 20px', textAlign: 'center', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent-blue)" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Loading Dashboard...</h2>
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" />;

  if (!hotel) {
    return (
      <div className="container" style={{ padding: '5rem 20px', maxWidth: '600px', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <Building size={64} color="var(--text-secondary)" style={{ marginBottom: '1.5rem', opacity: 0.7 }} />
          <h2 style={{ marginBottom: '1rem' }}>No Hotel Assigned</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            You are logged in as an administrator, but you do not currently have a hotel assigned to your account.
          </p>
          <a href="/profile" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Go to Profile</a>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '4rem 20px', minHeight: '90vh' }}>
      
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '3rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', trackingLetter: '1px', marginBottom: '0.5rem' }}>
            <Sparkles size={16} /> Hotel Administration
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>{hotel.name}</h1>
          <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>📍 {hotel.address}, {hotel.city}, {hotel.country}</span>
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => { setActiveTab('rooms'); setErrorMsg(''); setSuccessMsg(''); }} 
            className="tab-button"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600,
              background: activeTab === 'rooms' ? 'var(--accent-blue)' : 'transparent', 
              color: activeTab === 'rooms' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <List size={18} /> Manage Rooms
          </button>
          <button 
            onClick={() => { setActiveTab('availability'); setErrorMsg(''); setSuccessMsg(''); }} 
            className="tab-button"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600,
              background: activeTab === 'availability' ? 'var(--accent-blue)' : 'transparent', 
              color: activeTab === 'availability' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Calendar size={18} /> Set Availability
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'fadeIn 0.3s ease' }}>
          <CheckCircle size={20} /> <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'fadeIn 0.3s ease' }}>
          <AlertCircle size={20} /> <span>{errorMsg}</span>
        </div>
      )}

      {/* Content tabs */}
      {activeTab === 'rooms' && (
        <div style={{ display: 'grid', gap: '2.5rem', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr' }}>
          
          {/* Add Room Section */}
          <div className="glass" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="var(--accent-blue)" /> Add New Room Type
            </h3>
            
            <form onSubmit={handleAddRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Room Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Deluxe Ocean View Suite" 
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Capacity (guests)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 3" 
                    value={newCapacity}
                    onChange={e => setNewCapacity(e.target.value)}
                    required 
                    min="1"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Physical Rooms</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 15" 
                    value={newTotalRooms}
                    onChange={e => setNewTotalRooms(e.target.value)}
                    required 
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Price per Night ($)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 240" 
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  required 
                  min="0"
                  step="0.01"
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} disabled={roomActionLoading}>
                {roomActionLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Adding Room...
                  </>
                ) : 'Add Room Type'}
              </button>
            </form>
          </div>

          {/* Rooms List Section */}
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={20} color="var(--accent-blue)" /> Active Room Configurations
            </h3>
            
            {rooms.length === 0 ? (
              <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No room types defined yet. Use the form on the left to set up your room schemas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {rooms.map(r => (
                  <div key={r.id} className="glass card-hover" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s' }}>
                    <div>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{r.name}</h4>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        <span>Capacity: <strong>{r.capacity} guests</strong></span>
                        <span>Total Inventory: <strong>{r.total_rooms} rooms</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-blue)' }}>${r.price_per_night}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>per night</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'availability' && (
        <div className="glass" style={{ padding: '3rem', maxWidth: '650px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={24} color="var(--accent-blue)" /> Update Availability Calendar
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.5' }}>
            Define custom date ranges when guests are allowed to reserve specific room types. Dates outside of these active vacancy slots will not appear in user searches.
          </p>
          
          <form onSubmit={handleUpdateAvailability} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Select Room Type</label>
              <select required value={availRoomTypeId} onChange={e => setAvailRoomTypeId(e.target.value)}>
                <option value="">Choose room type...</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (${r.price_per_night}/night)</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Start Date</label>
                <input 
                  type="date" 
                  value={availStartDate} 
                  onChange={e => setAvailStartDate(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>End Date</label>
                <input 
                  type="date" 
                  value={availEndDate} 
                  onChange={e => setAvailEndDate(e.target.value)} 
                  required 
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Vacancy Status</label>
              <div style={{ display: 'flex', gap: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <input 
                    type="radio" 
                    name="status" 
                    value="true" 
                    checked={availStatus === 'true'} 
                    onChange={e => setAvailStatus(e.target.value)} 
                    style={{ width: 'auto' }} 
                  /> 
                  <strong>Boş (Open for Bookings)</strong>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <input 
                    type="radio" 
                    name="status" 
                    value="false" 
                    checked={availStatus === 'false'} 
                    onChange={e => setAvailStatus(e.target.value)} 
                    style={{ width: 'auto' }} 
                  /> 
                  <strong>Dolu (Closed / Blocked)</strong>
                </label>
              </div>
            </div>
            
            {availStatus === 'true' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Custom Vacant Count (Optional)
                </label>
                <input 
                  type="number" 
                  placeholder="Defaults to total room type capacity if empty..." 
                  value={availCount}
                  onChange={e => setAvailCount(e.target.value)}
                  min="0"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Leave blank to allow booking up to the full room type inventory count.
                </span>
              </div>
            )}
            
            <button type="submit" className="btn-primary" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} disabled={availActionLoading}>
              {availActionLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Saving Availability...
                </>
              ) : 'Update Availability Calendar'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

