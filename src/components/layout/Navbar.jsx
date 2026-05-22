import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { LoginModal, RegisterModal } from '../auth/AuthModals';
import { User, LogOut, Hotel } from 'lucide-react';

export default function Navbar() {
  const { user, profile, logout, isAdmin } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  return (
    <>
      <nav style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)', background: 'var(--glass-bg)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
              <Hotel color="var(--accent-blue)" size={32} />
              Hotello
            </Link>
            <Link to="/explore" style={{ fontWeight: 500, color: 'var(--text-secondary)', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color='white'} onMouseOut={e => e.target.style.color='var(--text-secondary)'}>
              Explore
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user ? (
              <>
                {!profile?.full_name ? (
                  <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 600, textDecoration: 'none' }}>
                    <User size={20} />
                    <span>⚠️ Complete Profile</span>
                  </Link>
                ) : (
                  <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
                    ) : (
                      <User size={20} />
                    )}
                    <span onMouseOver={e => e.target.style.color='white'} onMouseOut={e => e.target.style.color='var(--text-secondary)'}>{profile.full_name}</span>
                  </Link>
                )}
                {isAdmin && (
                  <Link to="/admin" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                    Admin Panel
                  </Link>
                )}
                <button onClick={logout} style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setShowLogin(true)} className="btn-secondary">Log In</button>
                <button onClick={() => setShowRegister(true)} className="btn-primary">Sign Up</button>
              </>
            )}
          </div>

        </div>
      </nav>

      <LoginModal 
        isOpen={showLogin} 
        onClose={() => setShowLogin(false)} 
        onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true); }} 
      />
      <RegisterModal 
        isOpen={showRegister} 
        onClose={() => setShowRegister(false)} 
        onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }} 
      />
    </>
  );
}
