import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! I am the Hotello AI Agent. I can help you find and book hotels. Where would you like to go?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useAuth(); // Need to potentially pass token to AI endpoint if booking

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const token = user ? (await supabase.auth.getSession()).data.session?.access_token : null;
      
      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      const data = await response.json();
      setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="btn-primary"
          style={{ position: 'fixed', bottom: '2rem', right: '2rem', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(59,130,246,0.5)', zIndex: 999 }}
        >
          <MessageCircle size={28} />
        </button>
      )}

      {isOpen && (
        <div className="glass" style={{ position: 'fixed', bottom: '2rem', right: '2rem', width: '380px', height: '500px', display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ padding: '1rem', background: 'var(--surface-color-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Bot color="var(--accent-blue)" /> Hotello AI Agent
            </div>
            <button onClick={() => setIsOpen(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ 
                  padding: '10px 14px', 
                  borderRadius: '16px', 
                  background: msg.role === 'user' ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' : 'var(--surface-color)',
                  color: 'white',
                  borderBottomRightRadius: msg.role === 'user' ? 0 : '16px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? 0 : '16px',
                  lineHeight: 1.4,
                  fontSize: '0.95rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--surface-color)', padding: '10px 14px', borderRadius: '16px', borderBottomLeftRadius: 0, display: 'flex', gap: '4px' }}>
                <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
                <span style={{ animation: 'pulse 1.5s infinite', animationDelay: '0.2s' }}>●</span>
                <span style={{ animation: 'pulse 1.5s infinite', animationDelay: '0.4s' }}>●</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', background: 'var(--surface-color)' }}>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Ask me anything..." 
              style={{ flex: 1, padding: '10px 14px', borderRadius: '20px' }}
            />
            <button type="submit" disabled={!input.trim() || loading} style={{ background: 'var(--accent-blue)', color: 'white', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
