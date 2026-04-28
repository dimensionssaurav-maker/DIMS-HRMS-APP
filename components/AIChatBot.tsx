import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, X, Send, Bot, User, Minimize2,
  Mic, MicOff, Volume2, VolumeX, Waves,
  FileText, FileBarChart, Clock as ClockIcon, IndianRupee,
  Settings, PlayCircle
} from 'lucide-react';
import { createHRChat } from '../services/geminiService';
import {
  detectReportIntent,
  generateMonthlyAttendancePDF,
  generateDailyPunchPDF,
  generateLateArrivalsPDF,
  generateSalaryPDF,
} from '../services/pdfReports';

// ── Helpers ──────────────────────────────────────────────────────────────────
const lsGet = (key: string, fallback: string): string => {
  try { return window.localStorage?.getItem(key) || fallback; } catch { return fallback; }
};
const lsSet = (key: string, val: string) => {
  try { window.localStorage?.setItem(key, val); } catch {}
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'model'; text: string; isVoice?: boolean; }
interface Props   { appContext: any; }

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const AIChatBot: React.FC<Props> = ({ appContext }) => {

  // Chat state
  const [isOpen,    setIsOpen]    = useState(false);
  const [messages,  setMessages]  = useState<Message[]>([
    { role: 'model', text: 'Hi! I am ZenAI. Ask me anything about HR, payroll, or labour law.' }
  ]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // TTS / STT capability flags (set after mount)
  const [ttsReady,   setTtsReady]   = useState(false);
  const [sttReady,   setSttReady]   = useState(false);

  // Voice UI state
  const [voiceMode,    setVoiceMode]    = useState(false);
  const [isListening,  setIsListening]  = useState(false);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [voiceStatus,  setVoiceStatus]  = useState('');

  // Settings
  const [autoSpeak,  setAutoSpeak]  = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [language,   setLanguage]   = useState<'en' | 'hi'>(() =>
    lsGet('zenai_lang', 'en') === 'hi' ? 'hi' : 'en'
  );
  const [speechRate,  setSpeechRate]  = useState(() => parseFloat(lsGet('zenai_rate',  '0.85')));
  const [speechPitch, setSpeechPitch] = useState(() => parseFloat(lsGet('zenai_pitch', '1.0')));
  const [voiceName,   setVoiceName]   = useState(() => lsGet('zenai_voice', ''));
  const [allVoices,   setAllVoices]   = useState<SpeechSynthesisVoice[]>([]);

  // Refs
  const chatRef   = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef    = useRef<any>(null);
  const synthRef  = useRef<SpeechSynthesis | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // ── Init speech APIs on mount ──────────────────────────────────────────────
  useEffect(() => {
    const hasTTS = 'speechSynthesis' in window;
    const hasSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setTtsReady(hasTTS);
    setSttReady(hasSTT);

    if (hasTTS) {
      synthRef.current = window.speechSynthesis;
      const load = () => {
        const v = window.speechSynthesis.getVoices();
        voicesRef.current = v;
        setAllVoices(v.filter(x => x.lang.startsWith('en') || x.lang.startsWith('hi')));
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  // ── Reset chat when live data loads ───────────────────────────────────────
  useEffect(() => {
    chatRef.current = null;
  }, [
    appContext?.employees?.length,
    appContext?.attendanceSummary,
    appContext?.selectedMonth,
    appContext?.selectedYear,
  ]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, transcript]);

  // ── TTS speak ─────────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current) { console.warn('ZenAI: TTS not available'); onEnd?.(); return; }
    if (!autoSpeak)        { onEnd?.(); return; }

    synthRef.current.cancel();
    setIsSpeaking(false);

    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g,     '$1')
      .replace(/#{1,6}\s/g,      '')
      .replace(/`[^`]*`/g,       '')
      .replace(/\|/g,            ' ')
      .replace(/\n+/g,           '. ')
      .replace(/\s+/g,           ' ')
      .trim()
      .slice(0, 600);

    if (!clean) { onEnd?.(); return; }

    const utt  = new SpeechSynthesisUtterance(clean);
    utt.lang   = language === 'hi' ? 'hi-IN' : 'en-IN';
    utt.rate   = speechRate;
    utt.pitch  = speechPitch;
    utt.volume = 1;

    const voices = voicesRef.current;
    const pick = voiceName
      ? voices.find(v => v.name === voiceName)
      : language === 'hi'
        ? (voices.find(v => v.lang === 'hi-IN') || voices.find(v => v.lang.startsWith('hi')))
        : (voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
           voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
           voices.find(v => v.lang === 'en-IN') ||
           voices.find(v => v.lang.startsWith('en')));
    if (pick) utt.voice = pick;

    utt.onstart = () => { console.log('ZenAI speaking:', clean.slice(0,40)); setIsSpeaking(true); };
    utt.onend   = () => { setIsSpeaking(false); onEnd?.(); };
    utt.onerror = (e) => { console.warn('ZenAI TTS error:', e.error); setIsSpeaking(false); onEnd?.(); };

    // Chrome bug workaround: must call speak() after a tiny delay sometimes
    setTimeout(() => synthRef.current?.speak(utt), 50);
  }, [autoSpeak, language, speechRate, speechPitch, voiceName, stopSpeaking]);

  // ── STT listen ────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (isLoading) return;
    stopSpeaking();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceStatus('Mic not supported in this browser.'); return; }

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = language === 'hi' ? 'hi-IN' : 'en-IN';
    recRef.current     = rec;

    let final = '';

    rec.onstart  = () => { setIsListening(true); setTranscript(''); setVoiceStatus('Listening… speak now'); };
    rec.onresult = (e: any) => {
      let interim = '';
      final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      setTranscript(final || interim);
    };
    rec.onend    = () => {
      setIsListening(false); setTranscript(''); setVoiceStatus('');
      if (final.trim()) sendMessage(final.trim(), true);
    };
    rec.onerror  = (e: any) => {
      setIsListening(false); setTranscript('');
      if (e.error === 'not-allowed') {
        setVoiceStatus('Mic blocked — allow microphone in browser settings.');
        setVoiceMode(false);
      } else {
        setVoiceStatus(`Mic error: ${e.error}. Try again.`);
      }
      setTimeout(() => setVoiceStatus(''), 4000);
    };

    try { rec.start(); } catch (e) { console.error('STT start error:', e); }
  }, [isLoading, language]);

  const stopListening = useCallback(() => { recRef.current?.stop(); }, []);

  // ── Report PDF shortcut ───────────────────────────────────────────────────
  const runReportIntent = useCallback(async (text: string): Promise<string | null> => {
    const intent = detectReportIntent(text);
    if (!intent) return null;
    const ctx      = appContext || {};
    const employees  = ctx.employees       || [];
    const attendance = ctx.attendanceRecords || [];
    const holidays   = ctx.holidays        || [];
    const payroll    = ctx.payrollData     || [];
    const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const mName      = MONTHS[intent.month ?? new Date().getMonth()];
    try {
      switch (intent.type) {
        case 'monthly_attendance':
        case 'summary': {
          const f = await generateMonthlyAttendancePDF(intent.month!, intent.year!, employees, attendance, holidays);
          return `Monthly attendance report for ${mName} ${intent.year} saved as ${f}.`;
        }
        case 'daily_punch': {
          const f = await generateDailyPunchPDF(intent.date!, employees, attendance);
          return `Daily punch report for ${intent.date} saved as ${f}.`;
        }
        case 'late_arrivals': {
          const f = await generateLateArrivalsPDF(intent.month!, intent.year!, employees, attendance);
          return `Late arrivals report for ${mName} ${intent.year} saved as ${f}.`;
        }
        case 'salary': {
          if (!payroll.length) return `Payroll data is empty. Open the Payroll page for ${mName} ${intent.year} first, then ask again.`;
          const f = await generateSalaryPDF(intent.month!, intent.year!, employees, payroll);
          return `Salary report for ${mName} ${intent.year} saved as ${f}.`;
        }
      }
    } catch (err: any) {
      return `PDF error: ${err?.message || 'unknown'}. Try again.`;
    }
    return null;
  }, [appContext]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, isVoice = false) => {
    if (!text.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text, isVoice }]);
    setIsLoading(true);
    setVoiceStatus(isVoice ? 'ZenAI is thinking…' : '');

    const afterSpeak = (reply: string) => {
      if (isVoice && voiceMode) {
        speak(reply, () => { if (voiceMode) setTimeout(startListening, 700); });
      } else {
        speak(reply);   // auto-speak in text mode too
      }
    };

    try {
      const reportReply = await runReportIntent(text);
      if (reportReply) {
        setMessages(prev => [...prev, { role: 'model', text: reportReply }]);
        setVoiceStatus('');
        afterSpeak(reportReply);
        return;
      }

      if (!chatRef.current) chatRef.current = createHRChat(appContext);
      const prompt = language === 'hi'
        ? text + '\n\n[Please reply in Hindi (Devanagari). Numbers and law names can stay in English.]'
        : text;

      const response = await chatRef.current.sendMessage({ message: prompt });
      const reply = response.text || (language === 'hi' ? 'उत्तर नहीं मिला।' : "No response received.");
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
      setVoiceStatus('');
      afterSpeak(reply);

    } catch (err: any) {
      const detail = err?.message || String(err) || 'unknown error';
      console.error('ZenAI API error:', detail);
      const errMsg = `API Error: ${detail.slice(0, 150)}`;
      setMessages(prev => [...prev, { role: 'model', text: errMsg }]);
      setVoiceStatus('');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, appContext, voiceMode, language, speak, startListening, runReportIntent]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg) return;
    setInput('');
    sendMessage(msg, false);
  };

  const handleMicClick = () => {
    if (isListening) { stopListening(); return; }
    if (isSpeaking)  { stopSpeaking(); }
    setTimeout(startListening, 120);
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      setVoiceMode(false);
      stopListening();
      stopSpeaking();
      setVoiceStatus('');
      setTranscript('');
    } else {
      setVoiceMode(true);
      setVoiceStatus('Voice mode on — tap 🎤 to speak');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end select-none">

      {isOpen && (
        <div className="bg-white w-[380px] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4"
          style={{ height: voiceMode ? '530px' : '620px' }}>

          {/* ── Header ── */}
          <div className={`p-4 text-white flex items-center justify-between shadow-lg ${voiceMode ? 'bg-gradient-to-r from-violet-700 via-indigo-600 to-indigo-700' : 'bg-indigo-600'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isListening ? 'bg-red-400/30 animate-pulse' : isSpeaking ? 'bg-emerald-400/20 animate-pulse' : 'bg-white/15'}`}>
                <Bot size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  ZenAI Assistant
                  {voiceMode && <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">VOICE</span>}
                </h4>
                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest">
                  {isListening ? '🔴 Listening…' : isSpeaking ? '🔊 Speaking…' : isLoading ? '⏳ Thinking…' : autoSpeak ? '🔊 Voice On' : '🔇 Voice Off'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language */}
              <button onClick={() => {
                  const next = language === 'hi' ? 'en' : 'hi';
                  setLanguage(next); lsSet('zenai_lang', next);
                  stopSpeaking();
                  if (chatRef.current?.clearHistory) chatRef.current.clearHistory();
                }}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-black uppercase tracking-widest">
                {language === 'hi' ? 'हिन्दी' : 'EN'}
              </button>

              {/* Mute / unmute — always visible */}
              {ttsReady && (
                <button onClick={() => { setAutoSpeak(p => !p); if (isSpeaking) stopSpeaking(); }}
                  title={autoSpeak ? 'Mute voice' : 'Unmute voice'}
                  className={`p-1.5 rounded-lg transition-all ${autoSpeak ? 'bg-white/25 text-white' : 'bg-white/8 text-white/40'}`}>
                  {autoSpeak ? <Volume2 size={16}/> : <VolumeX size={16}/>}
                </button>
              )}

              {/* Voice settings — always visible when TTS available */}
              {ttsReady && (
                <button onClick={() => setShowSettings(p => !p)}
                  title="Voice Settings"
                  className={`p-1.5 rounded-lg transition-all ${showSettings ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'}`}>
                  <Settings size={15}/>
                </button>
              )}

              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl">
                <Minimize2 size={18}/>
              </button>
            </div>
          </div>

          {/* ── Voice status bar ── */}
          {voiceMode && (
            <div className={`px-4 py-2 flex items-center justify-between border-b text-xs font-bold ${isListening ? 'bg-red-50 border-red-100 text-red-600' : isSpeaking ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-violet-50 border-violet-100 text-violet-700'}`}>
              <div className="flex items-center gap-2">
                {isListening && (
                  <div className="flex gap-0.5 items-end h-4">
                    {[1,2,3,4,3,2,1].map((h,i) => (
                      <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse" style={{ height:`${h*4}px`, animationDelay:`${i*80}ms` }}/>
                    ))}
                  </div>
                )}
                {isSpeaking && <Waves size={14} className="text-emerald-600 animate-pulse"/>}
                <span>{voiceStatus || (isListening ? 'Speak now…' : isSpeaking ? 'ZenAI is speaking…' : isLoading ? 'Processing…' : 'Tap 🎤 to speak')}</span>
              </div>
              {isSpeaking && (
                <button onClick={stopSpeaking} className="text-red-500 text-[10px] px-2 py-0.5 bg-red-50 rounded-full border border-red-200 font-black">
                  Stop ✕
                </button>
              )}
            </div>
          )}

          {/* ── Voice Settings Panel ── */}
          {showSettings && (
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-3 text-xs overflow-y-auto" style={{maxHeight:'230px'}}>
              <p className="font-black text-slate-500 uppercase tracking-widest text-[9px] flex items-center gap-1">
                <Settings size={9}/> Voice Settings
              </p>

              {/* Voice selector */}
              <div>
                <p className="font-bold text-slate-500 mb-1">Voice</p>
                <select value={voiceName}
                  onChange={e => { setVoiceName(e.target.value); lsSet('zenai_voice', e.target.value); }}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Auto (Best Available)</option>
                  {allVoices.map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>

              {/* Speed */}
              <div>
                <p className="font-bold text-slate-500 mb-1">Speed</p>
                <div className="flex gap-1.5">
                  {[{label:'🐢 Slow',val:0.65},{label:'🚶 Normal',val:0.85},{label:'🏃 Fast',val:1.1},{label:'⚡ Very Fast',val:1.4}].map(s => (
                    <button key={s.val} onClick={() => { setSpeechRate(s.val); lsSet('zenai_rate', String(s.val)); }}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[9px] border ${speechRate === s.val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch */}
              <div>
                <p className="font-bold text-slate-500 mb-1">Pitch</p>
                <div className="flex gap-1.5">
                  {[{label:'🔉 Low',val:0.7},{label:'🔊 Normal',val:1.0},{label:'🎵 High',val:1.3}].map(p => (
                    <button key={p.val} onClick={() => { setSpeechPitch(p.val); lsSet('zenai_pitch', String(p.val)); }}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[9px] border ${speechPitch === p.val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test voice */}
              <button onClick={() => speak('Hello! I am ZenAI. How can I help you today?')}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                <PlayCircle size={12}/> Test Voice
              </button>
            </div>
          )}

          {/* ── Text chat messages ── */}
          {!voiceMode && (
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>