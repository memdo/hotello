import React, { useState, useEffect, useRef } from 'react';
import { DateRange } from 'react-date-range';
import { format, addDays } from 'date-fns';
import 'react-date-range/dist/styles.css'; 
import 'react-date-range/dist/theme/default.css'; 

export default function DatePickerPopover({ 
  checkIn, 
  checkOut, 
  onChange, 
  flexibility, 
  onFlexibilityChange,
  onClose 
}) {
  const popoverRef = useRef(null);
  
  const [state, setState] = useState([
    {
      startDate: checkIn ? new Date(checkIn) : new Date(),
      endDate: checkOut ? new Date(checkOut) : addDays(new Date(), 7),
      key: 'selection'
    }
  ]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleSelect = (ranges) => {
    setState([ranges.selection]);
    if (ranges.selection.startDate !== ranges.selection.endDate) {
      onChange({
        checkIn: format(ranges.selection.startDate, 'yyyy-MM-dd'),
        checkOut: format(ranges.selection.endDate, 'yyyy-MM-dd')
      });
    }
  };

  const flexOptions = [
    { label: 'Exact dates', value: 0 },
    { label: '± 1 day', value: 1 },
    { label: '± 2 days', value: 2 },
    { label: '± 3 days', value: 3 },
    { label: '± 7 days', value: 7 },
  ];

  return (
    <div ref={popoverRef} className="glass" style={{
      position: 'absolute',
      top: 'calc(100% + 10px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      padding: '1.5rem',
      borderRadius: '16px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      background: 'rgba(20, 20, 20, 0.95)',
      backdropFilter: 'blur(20px)'
    }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <button style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 600, fontSize: '1rem', borderBottom: '2px solid white', paddingBottom: '0.25rem', cursor: 'pointer' }}>Calendar</button>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>Flexible dates</button>
      </div>

      <div className="custom-date-range">
        <DateRange
          onChange={handleSelect}
          showSelectionPreview={true}
          moveRangeOnFirstSelection={false}
          months={2}
          ranges={state}
          direction="horizontal"
          minDate={new Date()}
          rangeColors={['var(--accent-blue)']}
        />
      </div>

      {/* Flexible Dates UI */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        {flexOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onFlexibilityChange(opt.value)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: flexibility === opt.value ? '1px solid var(--accent-blue)' : '1px solid var(--text-secondary)',
              background: flexibility === opt.value ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: flexibility === opt.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
