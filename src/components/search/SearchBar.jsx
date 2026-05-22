import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Users, Search } from 'lucide-react';

export default function SearchBar() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (checkIn) params.append('checkIn', checkIn);
    if (checkOut) params.append('checkOut', checkOut);
    if (guests) params.append('guests', guests);
    
    navigate(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="glass" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', alignItems: 'center' }}>
      
      <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', padding: '0 12px' }}>
        <MapPin color="var(--text-secondary)" size={20} />
        <input 
          type="text" 
          placeholder="Where to?" 
          value={city} 
          onChange={e => setCity(e.target.value)} 
          style={{ background: 'transparent', border: 'none', color: 'white' }} 
        />
      </div>

      <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', padding: '0 12px' }}>
        <Calendar color="var(--text-secondary)" size={20} />
        <input 
          type="date" 
          value={checkIn} 
          onChange={e => setCheckIn(e.target.value)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }} 
        />
      </div>

      <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', padding: '0 12px' }}>
        <Calendar color="var(--text-secondary)" size={20} />
        <input 
          type="date" 
          value={checkOut} 
          onChange={e => setCheckOut(e.target.value)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }} 
        />
      </div>

      <div style={{ flex: '1 1 120px', display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', padding: '0 12px' }}>
        <Users color="var(--text-secondary)" size={20} />
        <input 
          type="number" 
          min="1"
          value={guests} 
          onChange={e => setGuests(e.target.value)} 
          style={{ background: 'transparent', border: 'none', color: 'white' }} 
        />
      </div>

      <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '12px 24px' }}>
        <Search size={20} /> Search
      </button>

    </form>
  );
}
