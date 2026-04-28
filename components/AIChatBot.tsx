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
    { role: 'model', text: 'Ask me anything about HR, payroll, attendance, or Indian labour law.' }
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
    if (!synthRef.current) { onEnd?.(); return; }
    if (!autoSpeak)        { onEnd?.(); return; }

    try { synthRef.current.cancel(); } catch {}
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
      .slice(0, 500);

    if (!clean) { onEnd?.(); return; }

    // Build utterance — voiceOverride=undefined uses saved setting,
    // voiceOverride=null means "let browser pick" (fallback after synthesis-failed)
    const makeUtt = (voiceOverride?: SpeechSynthesisVoice | null) => {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang   = language === 'hi' ? 'hi-IN' : 'en-IN';
      u.rate   = speechRate;
      u.pitch  = speechPitch;
      u.volume = 1;

      if (voiceOverride !== undefined) {
        // null = use browser default; SpeechSynthesisVoice = use that voice
        if (voiceOverride) u.voice = voiceOverride;
      } else {
        const voices = voicesRef.current;
        const pick = voiceName
          ? voices.find(v => v.name === voiceName)
          : language === 'hi'
            ? (voices.find(v => v.lang === 'hi-IN' && v.localService) ||
               voices.find(v => v.lang === 'hi-IN') ||
               voices.find(v => v.lang.startsWith('hi')))
            : (voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
               voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en') && v.localService) ||
               voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
               voices.find(v => v.lang === 'en-IN') ||
               voices.find(v => v.lang.startsWith('en')));
        if (pick) u.voice = pick;
      }

      u.onstart = () => { setIsSpeaking(true); };
      u.onend   = () => { setIsSpeaking(false); onEnd?.(); };
      u.onerror = (e: any) => {
        setIsSpeaking(false);
        if (e.error === 'interrupted') return; // expected — suppress noise
        if (e.error === 'synthesis-failed' && voiceOverride !== null) {
          // Online voice failed (network/Edge restriction) — retry with browser default
          console.warn('ZenAI: voice synthesis failed, retrying with default voice');
          setTimeout(() => {
            if (!synthRef.current) { onEnd?.(); return; }
            try {
              if (synthRef.current.paused) synthRef.current.resume();
              synthRef.current.speak(makeUtt(null));
            } catch { onEnd?.(); }
          }, 200);
        } else {
          onEnd?.();
        }
      };
      return u;
    };

    // Edge/Chrome fix: resume if paused, delay before speak
    try {
      if (synthRef.current.paused) synthRef.current.resume();
      setTimeout(() => {
        if (!synthRef.current) return;
        if (synthRef.current.paused) synthRef.current.resume();
        synthRef.current.speak(makeUtt(undefined));
      }, 120);
    } catch (e) { onEnd?.(); }
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
        <div className="bg-white w-[460px] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4"
          style={{ height: voiceMode ? '640px' : '740px' }}>

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
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${showSettings ? 'bg-white/30 text-white' : 'bg-white/15 hover:bg-white/25 text-white'}`}>
                  <Settings size={13}/> Voice
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
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-3 text-xs overflow-y-auto" style={{maxHeight:'280px'}}>
              <p className="font-black text-slate-500 uppercase tracking-widest text-[9px] flex items-center gap-1">
                <Settings size={9}/> Voice Settings
              </p>

              {/* Curated voice picker */}
              {(() => {
                const EN_PICKS = [
                  {label:'Aria',    kw:'Aria'},
                  {label:'Jenny',   kw:'Jenny'},
                  {label:'Leah',    kw:'Leah'},
                  {label:'Ravi',    kw:'Ravi'},
                  {label:'Sonia',   kw:'Sonia'},
                  {label:'Ryan',    kw:'Ryan'},
                ];
                const HI_PICKS = [
                  {label:'Swara',   kw:'Swara'},
                  {label:'Madhur',  kw:'Madhur'},
                  {label:'आरती',   kw:'\u0906\u0930\u0924\u0940'},
                  {label:'आरव',    kw:'\u0906\u0930\u0935'},
                  {label:'Hemant',  kw:'Hemant'},
                  {label:'Kalpana', kw:'Kalpana'},
                ];
                const enVoices = EN_PICKS.map(p => ({ ...p, voice: allVoices.find(v => v.name.includes(p.kw) && v.lang.startsWith('en')) })).filter(p => p.voice);
                const hiVoices = HI_PICKS.map(p => ({ ...p, voice: allVoices.find(v => v.name.includes(p.kw) && v.lang.startsWith('hi')) })).filter(p => p.voice);
                const renderPills = (list: any[]) => (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <button onClick={() => { setVoiceName(''); lsSet('zenai_voice',''); }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${!voiceName ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                      Auto
                    </button>
                    {list.map(p => (
                      <button key={p.label} onClick={() => { setVoiceName(p.voice!.name); lsSet('zenai_voice', p.voice!.name); }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${voiceName === p.voice!.name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                );
                return (
                  <div>
                    <p className="font-bold text-slate-500 mb-0.5">🇬🇧 English Voice</p>
                    {enVoices.length ? renderPills(enVoices) : <p className="text-[10px] text-slate-400">No English voices found</p>}
                    <p className="font-bold text-slate-500 mb-0.5 mt-2">🇮🇳 Hindi Voice</p>
                    {hiVoices.length ? renderPills(hiVoices) : <p className="text-[10px] text-slate-400">No Hindi voices found</p>}
                  </div>
                );
              })()}

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
              <button onClick={() => speak(language === 'hi' ? 'नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?' : 'Hello! How can I help you with HR or payroll today?')}
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
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {msg.role === 'user' ? <User size={14}/> : <Bot size={14}/>}
                    </div>
                    <div className={`p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      {msg.role === 'model' && ttsReady && (
                        <button onClick={() => speak(msg.text)}
                          className="mt-1.5 text-[10px] flex items-center gap-1 font-bold text-indigo-300 hover:text-indigo-500">
                          <Volume2 size={10}/> Replay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isListening && transcript && (
                <div className="flex justify-end">
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-600 text-sm px-4 py-2 rounded-2xl max-w-[88%] italic animate-pulse">
                    "{transcript}"
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2 items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay:`${i*150}ms` }}/>
                    ))}
                    <span className="text-xs font-medium text-slate-400">ZenAI is thinking…</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Voice mode big mic UI ── */}
          {voiceMode && (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 gap-5">
              <div className="relative flex items-center justify-center">
                {isListening && (
                  <>
                    <div className="absolute w-32 h-32 rounded-full bg-red-400/20 animate-ping"/>
                    <div className="absolute w-28 h-28 rounded-full bg-red-400/15 animate-ping" style={{ animationDelay:'200ms' }}/>
                  </>
                )}
                {isSpeaking && (
                  <>
                    <div className="absolute w-32 h-32 rounded-full bg-emerald-400/20 animate-ping"/>
                    <div className="absolute w-28 h-28 rounded-full bg-emerald-400/15 animate-ping" style={{ animationDelay:'300ms' }}/>
                  </>
                )}
                <button onClick={handleMicClick} disabled={isLoading}
                  className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 disabled:opacity-50 active:scale-95 ${
                    isListening ? 'bg-red-500 scale-110' : isSpeaking ? 'bg-emerald-500' : 'bg-indigo-600 hover:scale-105'}`}>
                  {isListening ? <MicOff size={36}/> : isSpeaking ? <Volume2 size={36} className="animate-pulse"/> : <Mic size={36}/>}
                </button>
              </div>

              <div className="text-center">
                <p className="font-black text-slate-700 text-base">
                  {isListening ? 'Listening…' : isSpeaking ? 'ZenAI is Speaking' : isLoading ? 'Processing…' : 'Tap to Speak'}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {isSpeaking ? 'Tap mic to interrupt' : 'ZenAI will reply by voice'}
                </p>
              </div>

              {messages.length > 1 && (
                <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-3 max-h-24 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Bot size={10}/> Last Response
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {messages.filter(m => m.role === 'model').slice(-1)[0]?.text.slice(0, 160)}…
                  </p>
                </div>
              )}

              <div className="w-full flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Or type a message…"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-400"/>
                <button onClick={handleSend} disabled={!input.trim() || isLoading}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-xl disabled:opacity-40">
                  <Send size={14}/>
                </button>
              </div>
            </div>
          )}

          {/* ── Quick report chips ── */}
          {!voiceMode && (
            <div className="px-3 pt-2 pb-1 bg-white border-t border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Quick Reports</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label:'Monthly Attendance', icon:<FileBarChart size={11}/>, msg:'generate monthly attendance report', cls:'indigo' },
                  { label:'Daily Punch',         icon:<FileText size={11}/>,    msg:'generate today daily punch report', cls:'emerald' },
                  { label:'Late Arrivals',       icon:<ClockIcon size={11}/>,   msg:'generate late arrivals report for this month', cls:'rose' },
                  { label:'Salary',              icon:<IndianRupee size={11}/>, msg:'generate salary report for this month', cls:'amber' },
                ].map(r => (
                  <button key={r.label} onClick={() => sendMessage(r.msg)} disabled={isLoading}
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-${r.cls}-50 text-${r.cls}-700 hover:bg-${r.cls}-100 border border-${r.cls}-100 disabled:opacity-50`}>
                    {r.icon} {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Text input ── */}
          {!voiceMode && (
            <div className="p-3 bg-white border-t border-slate-100">
              <div className="flex gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-400">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about payroll, attendance, employees…"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-slate-700"/>
                <button onClick={handleSend} disabled={isLoading || !input.trim()}
                  className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 shadow-sm">
                  <Send size={16}/>
                </button>
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[9px] text-slate-400 font-medium">Powered by Gemini • DIMS HRMS</p>
            {sttReady ? (
              <button onClick={toggleVoiceMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border ${
                  voiceMode ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200'
                }`}>
                {voiceMode ? <MicOff size={11}/> : <Mic size={11}/>}
                {voiceMode ? 'Exit Voice' : '🎤 Voice Mode'}
              </button>
            ) : (
              <span className="text-[9px] text-amber-500 font-bold">🎤 Voice Mode needs Chrome/Edge</span>
            )}
          </div>
        </div>
      )}

      {/* ── FAB toggle button ── */}
      <button onClick={() => setIsOpen(p => !p)}
        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 active:scale-95 ${isOpen ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
        {isOpen ? <X size={24}/> : <MessageSquare size={24}/>}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"/>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-white"/>
          </div>
        )}
      </button>
    </div>
  );
};

export default AIChatBot;
