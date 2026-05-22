import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { Navigate } from 'react-router-dom';
import { User, Phone, FileText, Image as ImageIcon, Check } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, updateProfile, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setPhone(profile.phone || '');
      setDescription(profile.description || '');
    }
  }, [profile]);

  if (loading) return <div className="container" style={{ padding: '4rem 20px', textAlign: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/" />;

  const isProfileComplete = profile && profile.full_name;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    if (!fullName.trim()) {
        setError('Full Name is required.');
        setSaving(false);
        return;
    }

    const { error: updateError } = await updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl,
        phone: phone,
        description: description
    });

    if (updateError) {
        setError(updateError.message || 'Failed to update profile.');
    } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="container" style={{ padding: '3rem 20px', maxWidth: '800px', minHeight: 'calc(100vh - 200px)' }}>
      
      {!isProfileComplete ? (
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-blue)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-blue)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             Complete Your Profile Setup
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
             Welcome to Hotello! Before you can book rooms, leave reviews, or use our premium features, please take a moment to set up your profile name. Additional details are optional!
          </p>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left Side: Avatar Preview card */}
        <div>
          <div className="glass" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-color-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '3px solid var(--accent-blue)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = ''; }} />
              ) : (
                <User size={60} color="var(--text-secondary)" />
              )}
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{fullName || 'New User'}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</span>
            
            {isProfileComplete ? (
                <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '4px 8px', borderRadius: '12px', marginTop: '1rem', fontWeight: 600 }}>
                    Active Profile
                </span>
            ) : (
                <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '4px 8px', borderRadius: '12px', marginTop: '1rem', fontWeight: 600 }}>
                    Incomplete Setup
                </span>
            )}
          </div>
        </div>

        {/* Right Side: Profile Edit Form */}
        <div>
          <div className="glass" style={{ padding: '2.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Profile Information</h2>

            {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
            {success && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Check size={18} /> Profile saved successfully!
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  <User size={16} /> Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  <ImageIcon size={16} /> Avatar Image URL (Optional)
                </label>
                <input 
                  type="url" 
                  value={avatarUrl} 
                  onChange={e => setAvatarUrl(e.target.value)} 
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  <Phone size={16} /> Phone Number (Optional)
                </label>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="+1 (555) 019-2834"
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  <FileText size={16} /> Bio / Description (Optional)
                </label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Tell us a bit about yourself..."
                  rows={4}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'inherit' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Profile Details'}
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
