import { useState, useRef, useEffect } from 'react';
import './index.css';

const EMOJIS = {
  Angry: "😠", Disguist: "🤢", Fear: "😨",
  Happy: "😊", Neutral: "😐", Sad: "😢", Surprise: "😲"
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [lastEmotion, setLastEmotion] = useState("neutral");

  // auth state
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState(null);

  // app states
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  // Live Cam states
  const [streaming, setStreaming] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const loopTimer = useRef(null);

  // Chat states
  const [chatMessages, setChatMessages] = useState([
    { sender: "bot", text: "Hello! Ask me for advice or suggestions directly related to your current emotion." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef(null);

  // Dashboard & Admin states
  const [historyLogs, setHistoryLogs] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [globalLogsCount, setGlobalLogsCount] = useState(0);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/history/${currentUser}`);
      if (res.ok) setHistoryLogs(await res.json());
    } catch {}
  };

  const fetchAdminStats = async () => {
    try {
      const resp = await fetch("/api/admin/stats", {
        method: "POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({admin_user: currentUser, admin_pass: authPassword})
      });
      const data = await resp.json();
      if(data.success) {
        setAdminUsers(data.users);
        setGlobalLogsCount(data.total_logs);
      }
    } catch {}
  };

  const deleteUser = async (target) => {
    if(!window.confirm(`Are you sure you want to delete user '${target}' and their history?`)) return;
    try {
      await fetch(`/api/admin/delete/${target}`, {
        method: "POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({admin_user: currentUser, admin_pass: authPassword})
      });
      fetchAdminStats();
    } catch {}
  };

  const handleLogin = async (e, isRegister = false) => {
    if (e) e.preventDefault();
    if (!authUsername || !authPassword) {
      setAuthError({ ok: false, msg: "Enter both username and password." });
      return;
    }
    
    try {
      const res = await fetch(isRegister ? "/register" : "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (!isRegister) {
            setCurrentUser(data.username || "guest");
        } else {
            setAuthError({ ok: true, msg: data.message });
        }
      } else {
        setAuthError({ ok: false, msg: data.message || "Invalid credentials." });
      }
    } catch {
      setAuthError({ ok: false, msg: "Network error." });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    clearInterval(loopTimer.current);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab !== "live") stopCamera();
    if (tab === "profile") fetchHistory();
    if (tab === "admin") fetchAdminStats();
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (f && f.type.startsWith("image/")) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/predict", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        if(data.face_detected) setLastEmotion(data.emotion);
      } else alert("Error: " + data.detail);
    } catch (err) {
      alert("Network error: " + err.message);
    }
    setIsAnalyzing(false);
  };

  const toggleCamera = async () => {
    if (streaming) return stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:"user", width:{ideal:640}, height:{ideal:480} }
      });
      videoRef.current.srcObject = stream;
      setStreaming(true);
      loopTimer.current = setInterval(sendFrame, 500);
    } catch (err) {
      alert("Camera denied: " + err.message);
    }
  };

  const sendFrame = async () => {
    if (!videoRef.current || !videoRef.current.videoWidth) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const b64 = canvas.toDataURL("image/jpeg", 0.6);
    try {
      const res = await fetch("/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, username: currentUser })
      });
      const data = await res.json();
      if (data.status === "success") {
        setLastEmotion(data.emotion);
        setResult(data);
      } else {
        setResult({ emotion:"No face", emoji:"👀", confidence:0, all_scores:{} });
      }
    } catch {}
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatSending) return;
    const text = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: "user", text }]);
    setChatInput("");
    setChatSending(true);

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, current_emotion: lastEmotion, username: currentUser })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { sender: "bot", text: data.reply || "Error." }]);
    } catch {
      setChatMessages(prev => [...prev, { sender: "bot", text: "Network Error." }]);
    }
    setChatSending(false);
  };

  if (!currentUser) {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="brand auth-brand">
            <span className="brand-icon">🧠</span>
            <div>
              <h1>Emotion<span className="gradient-text">Tracker</span></h1>
              <p className="subtitle">User Login</p>
            </div>
          </div>
          <form className="auth-form" onSubmit={(e) => handleLogin(e, false)}>
            <div className="form-group">
              <label>Username</label>
              <input value={authUsername} onChange={e=>setAuthUsername(e.target.value)} type="text" placeholder="demo" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input value={authPassword} onChange={e=>setAuthPassword(e.target.value)} type="password" placeholder="demo" />
            </div>
            {authError && <div className="auth-error" style={{color: authError.ok ? "var(--success)" : "var(--danger)"}}>{authError.msg}</div>}
            <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '.5rem'}}>Login</button>
            <button type="button" onClick={(e) => handleLogin(e, true)} className="btn btn-ghost" style={{width: '100%', marginTop: '.25rem'}}>Register</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <div className="app">
        <header>
          <div className="brand">
            <span className="brand-icon">🧠</span>
            <div>
              <h1>Emotion<span className="gradient-text">Tracker</span></h1>
              <p className="subtitle">Dashboard</p>
            </div>
          </div>
        </header>

        <nav className="tabs">
          <button onClick={() => switchTab("upload")} className={`tab ${activeTab === "upload" ? "active" : ""}`}>
            Upload Photo
          </button>
          <button onClick={() => switchTab("live")} className={`tab ${activeTab === "live" ? "active" : ""}`}>
            Live Camera
          </button>
          <button onClick={() => switchTab("profile")} className={`tab ${activeTab === "profile" ? "active" : ""}`}>
            Dashboard Insight
          </button>
          {currentUser.toLowerCase() === "admin" && (
              <button onClick={() => switchTab("admin")} className={`tab ${activeTab === "admin" ? "active" : ""}`}>
                Admin Portal
              </button>
          )}
          <div className="tab-indicator" style={{display: "none"}}></div>
        </nav>

        {activeTab === "upload" && (
          <section>
            <div className="card">
              <div 
                className={`dropzone ${preview ? "has-image" : ""}`} 
                onDragOver={e => e.preventDefault()} 
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('fileInput').click()}
              >
                {!preview ? (
                  <div id="dropzoneIdle">
                    <p className="dz-title">Drop your photo here</p>
                  </div>
                ) : (
                  <img src={preview} className="preview" alt="preview" />
                )}
                <input type="file" id="fileInput" accept="image/*" hidden onChange={handleFileDrop} />
              </div>
              <div className="card-actions">
                {preview && <button className="btn btn-ghost" onClick={() => { setFile(null); setPreview(null); setResult(null); }}>Clear</button>}
                <button className="btn btn-primary" disabled={!file || isAnalyzing} onClick={handleAnalyze}>
                   {isAnalyzing ? "Analyzing..." : "Analyze Emotion"}
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "live" && (
          <section>
            <div className="card">
              <div className="video-wrap">
                <video ref={videoRef} autoPlay playsInline muted></video>
                <canvas ref={canvasRef} hidden></canvas>
                {streaming && <div className="scan-line"></div>}
                
                <div className="live-badge">
                  <span>{result?.emoji || "😐"}</span>
                  <span>{result?.emotion || "Ready"}</span>
                </div>
                {streaming && (
                  <div className="live-conf"><span>{result?.confidence || "—"}%</span></div>
                )}
              </div>
              <button className={`btn ${streaming ? "btn-danger" : "btn-primary"}`} onClick={toggleCamera}>
                 {streaming ? "Stop Camera" : "Start Camera"}
              </button>
            </div>
          </section>
        )}

        {activeTab === "profile" && (
          <section className="profile-grid">
            <div className="card chat-card">
              <div className="chat-header">
                <div className="chat-avatar">👩‍⚕️</div>
                <div className="chat-info">
                  <h3>Wellness Assistant</h3>
                  <p>Sensing: {lastEmotion}</p>
                </div>
              </div>
              <div className="chat-messages">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`msg ${m.sender}`}>{m.text}</div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="chat-input-row">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="Ask for suggestions..." 
                  className="chat-input" 
                />
                <button onClick={sendChat} disabled={chatSending} className="btn btn-primary btn-send">Send</button>
              </div>
            </div>

            <div className="card analytics-card">
              <div className="chat-header" style={{marginBottom: '.5rem', borderBottom: 'none'}}>
                <h3>History</h3>
              </div>
              <p className="subtitle" style={{marginBottom: "1rem"}}>Your recent emotion logs</p>
              <div className="history-grid">
                {historyLogs.length === 0 ? <p style={{color:'var(--text-3)'}}>No history yet.</p> : historyLogs.map((l, i) => (
                  <div key={i} className={`h-box e-${l.emotion.toLowerCase()}`} title={`${l.timestamp}\nEmotion: ${l.emotion}\nMode: ${l.mode}\nConf: ${l.confidence}%`}></div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "admin" && currentUser.toLowerCase() === "admin" && (
          <section>
              <div className="card">
                 <div className="chat-header">
                   <h3>Admin Dashboard</h3>
                 </div>
                 <p className="subtitle" style={{marginBottom: "1rem"}}>Total System Logs: {globalLogsCount}</p>
                 <div className="admin-table-wrap">
                    <table className="admin-table">
                       <thead>
                          <tr><th>Username</th><th>Joined</th><th>Total Logs</th><th>Actions</th></tr>
                       </thead>
                       <tbody>
                          {adminUsers.map(u => (
                            <tr key={u.username}>
                              <td style={{fontWeight: 600, color: 'var(--primary)'}}>{u.username}</td>
                              <td>{u.created_at}</td>
                              <td>{u.log_count} Queries</td>
                              <td>
                                  {u.username !== "admin" && (
                                     <button className="btn btn-ghost" style={{color: 'var(--danger)', padding: '0.2rem 0.5rem'}} onClick={() => deleteUser(u.username)}>Delete User</button>
                                  )}
                              </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
          </section>
        )}

        {result && activeTab !== "profile" && activeTab !== "admin" && (
          <section className="card results">
            <div className="result-main">
              <div className="result-emoji">{result.emoji || "🤔"}</div>
              <div className="result-detail">
                <div className="result-label">{result.emotion}</div>
                <div className="conf-row">
                  <div className="conf-bar-bg">
                    <div className="conf-bar-fill" style={{width: `${result.confidence||0}%`}}></div>
                  </div>
                  <span>{result.confidence || 0}%</span>
                </div>
              </div>
            </div>
            
            <div className="score-list">
              {Object.entries(result.all_scores || {}).map(([emotion, pct], i) => (
                <div key={emotion} className={`score-row ${i===0?'top':''}`}>
                  <div className="label"><span>{EMOJIS[emotion]}</span> {emotion}</div>
                  <div className="bar-bg"><div className="bar" style={{width: `${pct}%`}}></div></div>
                  <div className="val">{pct}%</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
