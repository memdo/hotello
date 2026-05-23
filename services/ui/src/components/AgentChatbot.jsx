import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AgentChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm the Hotello AI Assistant. I can help you find and book rooms. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleChat = () => setIsOpen(!isOpen);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch(`/api/v1/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(1) // skip the initial greeting
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to communicate with Agent');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={toggleChat}
        style={{
          position: 'fixed', bottom: '40px', right: '40px',
          height: '64px', padding: '0 24px', borderRadius: '32px',
          backgroundColor: 'var(--primary)', color: 'var(--text-primary)',
          border: '2px solid var(--text-primary)', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
        }}
      >
        <span style={{ fontSize: '28px' }}>💬</span>
        AI Agent
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: '90px', right: '20px',
      width: '350px', height: '500px', backgroundColor: 'var(--surface-color)',
      borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      zIndex: 1000, border: '1px solid var(--border)'
    }}>
      <div style={{
        padding: '16px', backgroundColor: 'var(--primary)', color: 'var(--text-primary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Hotello AI Agent</h3>
        <button onClick={toggleChat} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
      </div>

      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-main)',
            color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--text-primary)',
            padding: '10px 14px', borderRadius: '8px', maxWidth: '85%',
            wordWrap: 'break-word', whiteSpace: 'pre-wrap', fontSize: '0.95rem'
          }}>
            {msg.content}
          </div>
        ))}
        {loading && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Agent is thinking...</div>}
      </div>

      <form onSubmit={sendMessage} style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me to find a hotel..."
          style={{
            flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)'
          }}
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={loading}
          style={{
            padding: '10px 16px', backgroundColor: 'var(--primary)', color: 'var(--text-primary)',
            border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
