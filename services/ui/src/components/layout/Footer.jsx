import React from 'react';
import { Hotel } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', padding: '4rem 0 2rem', borderTop: '1px solid var(--border)' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
              <Hotel color="var(--accent-blue)" size={32} />
              Hotello
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Your premium hotel booking experience powered by AI.</p>
          </div>
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Company</h4>
            <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>About Us</li>
              <li>Careers</li>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Support</h4>
            <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Help Center</li>
              <li>Contact Us</li>
              <li>Cancellation Options</li>
            </ul>
          </div>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
          © 2026 Hotello. All rights reserved. Built for SE4458.
        </div>
      </div>
    </footer>
  );
}
