import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Bot,
  Database,
  CloudSun,
  MapPin,
  Info,
  Lock,
  LogOut
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabase'
import { processAIQuery } from './aiService'
import './App.css'

interface Property {
  id: string;
  property_type: string;
  price: number;
  city: string;
  state: string;
  bedrooms: number;
  amenities: string[];
  image_url: string;
}

interface StaticData {
  property_type?: string;
  min_price?: number;
  max_price?: number;
  city?: string;
  state?: string;
  availability?: boolean;
  bedrooms?: number;
}

interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  data?: any;
  type?: 'text' | 'property' | 'weather';
}

function App() {
  const [input, setInput] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState('System Online')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI Property Assistant. How can I help you find your dream home today?",
      sender: 'bot',
      type: 'text'
    }
  ])
  const [staticData, setStaticData] = useState<StaticData>({})
  const [isCached, setIsCached] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isLoading) setStatusText('Analyzing Intent...')
    else setStatusText('System Online')
  }, [isLoading])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email || '')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
      if (session?.user?.email) {
        setUserEmail(session.user.email)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthMessage('')
    setIsLoading(true)
    
    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: userPassword,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: userEmail,
          password: userPassword,
        })
        if (error) throw error
        setAuthMessage('Sign up successful! You can now log in.')
        setIsLoginMode(true)
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isLoggedIn) scrollToBottom()
  }, [messages, isLoggedIn])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMsg: Message = { id: Date.now().toString(), text: input, sender: 'user' }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const aiResponse = await processAIQuery(input, staticData);

      const newStaticData = aiResponse.updatedState;
      setStaticData(newStaticData);

      let botResponse = aiResponse.message;
      let results: Property[] = [];
      let msgType: 'text' | 'property' | 'weather' = 'text';

      if (aiResponse.nextTool === 'WEATHER') {
        msgType = 'weather';
        botResponse = `${aiResponse.message} (fetching live conditions...)`;
      } else if (aiResponse.nextTool === 'DATABASE' && newStaticData.city && newStaticData.property_type) {
        setStatusText('Querying Supabase...');

        // Cache Check
        const { data: cacheData } = await supabase
          .from('property_search_cache')
          .select('*')
          .eq('city', newStaticData.city)
          .maybeSingle();

        if (cacheData && !input.toLowerCase().includes('studio')) {
          setIsCached(true);
          results = cacheData.results;
          botResponse = `(Cached) Found results for ${newStaticData.property_type}s in ${newStaticData.city}:`;
        } else {
          setIsCached(false);
          let queryBuilder = supabase
            .from('properties')
            .select('*')
            .eq('property_type', newStaticData.property_type)
            .eq('city', newStaticData.city)
            .limit(3);

          if (newStaticData.min_price) queryBuilder = queryBuilder.gte('price', newStaticData.min_price);
          if (newStaticData.max_price) queryBuilder = queryBuilder.lte('price', newStaticData.max_price);

          const { data, error } = await queryBuilder;

          if (error) {
            botResponse = "I encountered an error querying the property database.";
          } else if (data && data.length > 0) {
            results = data;
            botResponse = aiResponse.message || `Success! Here are ${data.length} ${newStaticData.property_type}s in ${newStaticData.city}:`;

            await supabase.from('property_search_cache').upsert({
              city: newStaticData.city,
              results: results
            });
          } else {
            botResponse = `I couldn't find any ${newStaticData.property_type}s in ${newStaticData.city} right now.`;
          }
        }
        msgType = 'property';
      }

      const botMsg: Message = {
        id: Date.now().toString() + Math.random(),
        text: botResponse,
        sender: 'bot',
        type: msgType,
        data: results.length > 0 ? results : null
      }
      setMessages(prev => [...prev, botMsg]);

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: err.message || "An error occurred in the AI Brain.",
        sender: 'bot'
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="login-container glass-card" style={{ padding: '3rem', width: '400px', textAlign: 'center', animation: 'fadeIn 0.5s ease-out' }}>
        <div className="bot-avatar" style={{ margin: '0 auto 1.5rem', width: '60px', height: '60px' }}>
          <Lock size={28} color="white" />
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>
          {isLoginMode ? 'AI Assistant Login' : 'Create Account'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Property & Weather Intelligence Portal</p>

        {authError && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>{authError}</div>}
        {authMessage && <div style={{ color: '#22c55e', marginBottom: '1rem', fontSize: '0.85rem', background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>{authMessage}</div>}

        <form onSubmit={handleAuth} style={{ display: 'grid', gap: '1rem' }}>
          <input
            type="email"
            className="chat-input"
            placeholder="Work Email"
            required
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
          <input 
            type="password" 
            className="chat-input" 
            placeholder="Password" 
            required 
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
          />
          <button disabled={isLoading} className="send-btn" style={{ width: '100%', height: '48px', marginTop: '1rem', borderRadius: '12px', fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? 'Processing...' : isLoginMode ? 'Authorize Session' : 'Sign Up'}
          </button>
        </form>
        
        <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isLoginMode ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button" 
            onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); setAuthMessage(''); }} 
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            {isLoginMode ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <section className="chat-window glass-card">
        <header className="chat-header">
          <div className="bot-avatar">
            <Bot size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>PropertyAssistant AI</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: isLoading ? 'var(--primary)' : 'var(--success)' }}>
              <div className={isLoading ? 'dot-pulse' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', boxShadow: isLoading ? 'none' : '0 0 8px currentColor' }} />
              {statusText}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="user-info" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{userEmail.split('@')[0]}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Authorized Agent</div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-muted)',
                padding: '0.5rem',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition)'
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="chat-messages">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`message ${msg.sender}`}
              >
                {msg.text}

                {msg.type === 'property' && msg.data && (
                  <div className="results-container">
                    {msg.data.map((prop: Property) => (
                      <div key={prop.id} className="property-mini-card">
                        <img
                          src={prop.image_url}
                          alt={prop.property_type}
                          style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover' }}
                        />
                        <div className="property-info">
                          <h4>{prop.property_type} in {prop.city}</h4>
                          <p>{prop.bedrooms} Bedrooms • {prop.amenities ? prop.amenities.join(', ') : ''}</p>
                          <div className="price-tag">${prop.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg.type === 'weather' && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <CloudSun size={32} color="#fbbf24" />
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>72°F</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sunny in {staticData.city}</div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <div className="message bot" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="dot-pulse" />
              Processing...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="input-wrapper">
            <input
              className="chat-input"
              placeholder="e.g., I'm looking for a 2 bedroom apartment in NY..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
          <button className="send-btn" onClick={handleSend}>
            <Send size={18} />
          </button>
        </div>
      </section>

      <aside className="sidebar">
        <div className="sidebar-section glass-card">
          <h3 className="section-title">
            <Database size={14} /> Workflow Static Data
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Persisted via <code>getWorkflowStaticData()</code>
          </p>

          <div className="param-grid">
            <ParamItem label="Prop Type" value={staticData.property_type} required />
            <ParamItem label="City" value={staticData.city} />
            <ParamItem label="State" value={staticData.state} />
            <ParamItem label="Min Price" value={staticData.min_price ? `$${staticData.min_price}` : undefined} />
            <ParamItem label="Max Price" value={staticData.max_price ? `$${staticData.max_price}` : undefined} />
            <ParamItem label="Bedrooms" value={staticData.bedrooms} />
          </div>

          <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px', border: '1px solid var(--primary-glow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
              <Info size={14} /> AI Decision Engine
            </div>
            <p style={{ fontSize: '0.7rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
              {staticData.property_type ? (
                staticData.city ? "Condition met: Search database triggered." : "Awaiting city before database query."
              ) : "Awaiting property_type (Required)."}
            </p>
          </div>
        </div>

        <div className="sidebar-section glass-card">
          <h3 className="section-title">
            <MapPin size={14} /> Current Cache
          </h3>
          {staticData.city ? (
            <div style={{ fontSize: '0.85rem', padding: '0.75rem', background: isCached ? 'rgba(34, 197, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)', border: isCached ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid var(--primary-glow)', borderRadius: '8px', color: isCached ? 'var(--success)' : 'var(--primary)' }}>
              {isCached ? `Results for ${staticData.city} served from Cache.` : `City ${staticData.city} query is now live.`}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No city results cached yet.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function ParamItem({ label, value, required }: { label: string, value?: any, required?: boolean }) {
  return (
    <div className="param-item">
      <span className="param-label">{label}{required && '*'}</span>
      <span className={`param-value ${!value && required ? 'missing' : ''}`}>
        {value || (required ? 'Required' : '—')}
      </span>
    </div>
  )
}

export default App
