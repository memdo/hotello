import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Users, Search } from 'lucide-react';
import DatePickerPopover from './DatePickerPopover';
import { format } from 'date-fns';

export default function SearchBar() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [flexibility, setFlexibility] = useState(0);
  const [guests, setGuests] = useState(2);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locations, setLocations] = useState([]);
  const [showLocations, setShowLocations] = useState(false);
  const locationRef = useRef(null);

  useEffect(() => {
    const cached = localStorage.getItem('hotel_locations');
    if (cached) {
      try { setLocations(JSON.parse(cached)); } catch(e) {}
    }

    fetch('/api/v1/hotels/locations')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setLocations(data);
          localStorage.setItem('hotel_locations', JSON.stringify(data));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setShowLocations(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredLocations = locations.filter(l => l.toLowerCase().includes(city.toLowerCase()));


  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (checkIn) params.append('checkIn', checkIn);
    if (checkOut) params.append('checkOut', checkOut);
    if (guests) params.append('guests', guests);
    if (flexibility > 0) params.append('flexibility', flexibility);
    
    navigate(`/search?${params.toString()}`);
  };

  const handleDateChange = ({ checkIn, checkOut }) => {
    setCheckIn(checkIn);
    setCheckOut(checkOut);
  };

  const formattedDates = () => {
    if (checkIn && checkOut) {
       const start = format(new Date(checkIn), 'MMM d');
       const end = format(new Date(checkOut), 'MMM d');
       return `${start} - ${end}`;
    }
    return "Check in - Check out";
  };

  return (
    <form onSubmit={handleSearch} className="glass" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', alignItems: 'center', position: 'relative' }}>
      
      <div ref={locationRef} style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', padding: '0 12px', position: 'relative' }}>
        <MapPin color="var(--text-secondary)" size={20} />
        <input 
          type="text" 
          placeholder="Where to?" 
          value={city} 
          onChange={e => {
            setCity(e.target.value);
            setShowLocations(true);
          }}
          onFocus={() => setShowLocations(true)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '12px', width: '100%', outline: 'none' }} 
        />
        
        {showLocations && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            width: '100%',
            background: 'var(--surface-color)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            zIndex: 1000,
            overflow: 'hidden',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {filteredLocations.length > 0 ? (
              filteredLocations.map(loc => (
                <div 
                  key={loc}
                  onClick={() => {
                    setCity(loc);
                    setShowLocations(false);
                  }}
                  style={{ padding: '12px 16px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-color-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MapPin size={16} color="var(--text-secondary)" />
                    <span style={{ fontWeight: 500 }}>{loc}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                No locations found
              </div>
            )}
          </div>
        )}
      </div>

      <div 
        style={{ flex: '2 1 300px', display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', padding: '12px', cursor: 'pointer' }}
        onClick={() => setShowDatePicker(true)}
      >
        <Calendar color="var(--text-secondary)" size={20} style={{ marginRight: '12px' }} />
        <span style={{ color: checkIn ? 'var(--text-primary)' : 'var(--text-secondary)', userSelect: 'none' }}>
          {formattedDates()}
        </span>
      </div>

      {showDatePicker && (
        <DatePickerPopover 
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={handleDateChange}
          flexibility={flexibility}
          onFlexibilityChange={setFlexibility}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <div style={{ flex: '1 1 120px', display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', padding: '0 12px' }}>
        <Users color="var(--text-secondary)" size={20} />
        <input 
          type="number" 
          min="1"
          value={guests} 
          onChange={e => setGuests(e.target.value)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '12px', width: '100%', outline: 'none' }} 
        />
      </div>

      <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '12px 24px' }}>
        <Search size={20} /> Search
      </button>

    </form>
  );
}
