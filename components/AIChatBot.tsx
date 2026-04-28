import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, X, Send, Bot, User, Loader2, Minimize2,
  Mic, MicOff, Volume2, VolumeX, Waves, ChevronDown,
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

interface Message {
  role: 'user' | 'model';
  text: string;
  isVoice?: boolean;
}

interface Props {
  appContext: any;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const AIChatBot: React.FC<Props> = ({ appContext }) => {
  const [isOpen, setIsOpen]           = useState(false);
  const [messages, setMessages]       = useState<Message[]>([
    { role: 'model', text: 'Hello! I am ZenAI, your HRMS voice assistant. Tap the mic and speak, or type your question.' }
  ]);
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);

  // Voice states
  const [voiceMode, setVoiceMode]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const [autoSpeak, setAutoSpeak]     = useState(true);
  const [voiceReady, setVoiceReady]   = useState(false);
  // 'en' = Indian English, 'hi' = हिन्दी. Persisted across sessions.
  const [language, setLanguage] = useState<'en' | 'hi'>(
    () => (typeof window !== 'undefined' && window.localStorage?.getItem('zenai_lang') === 'hi') ? 'hi' : 'en'
  );

  // Voice customization settings (safe localStorage reads)
  const safeGet = (key: string, fallback: string) => {
    try { return typeof window !== 'undefined' ? (window.localStorage?.getItem(key) || fallback) : fallback; } catch { return fallback; }
  };
  const [speechRate,  setSpeechRate]  = useState<number>(() => parseFloat(safeGet('zenai_rate',  '0.9')));
  const [speechPitch, setSpeechPitch] = useState<number>(() => parseFloat(safeGet('zenai_pitch', '1.0')));
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() => safeGet('zenai_voice', ''));
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const chatRef       = useRef<any>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef      = useRef<SpeechSynthesis | null>(null);
  const voicesRef     = useRef<SpeechSynthesisVoice[]>([]);

  // Init speech APIs
  useEffect(() => {
    const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasSS = !!window.speechSynthesis;
    setVoiceReady(hasSR && hasSS);

    if (hasSS) {
      synthRef.current = window.speechSynthesis;
      const loadVoices = () => {
        const all = window.speechSynthesis.getVoices();
        voicesRef.current = all;
        // Expose voices for settings panel — filter to English + Hindi
        setAvailableVoices(all.filter(v => v.lang.startsWith('en') || v.lang.startsWith('hi')));
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, transcript]);

  // ── TTS ─────────────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) synthRef.current.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current || !autoSpeak) { onEnd?.(); return; }
    stopSpeaking();

    // Clean markdown for speech
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/\|/g, ' ')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 800);

    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang   = language === 'hi' ? 'hi-IN' : 'en-IN';
    utt.rate   = speechRate;
    utt.pitch  = speechPitch;
    utt.volume = 1;

    // Use user-selected voice if set, otherwise pick best available
    const voices = voicesRef.current;
    const preferred = selectedVoiceName
      ? voices.find(v => v.name === selectedVoiceName)
      : language === 'hi'
        ? (voices.find(v => v.lang === 'hi-IN') ||
           voices.find(v => v.lang.startsWith('hi')) ||
           voices.find(v => v.name.toLowerCase().includes('hindi')))
        : (voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
           voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
           voices.find(v => v.lang === 'en-IN') ||
           voices.find(v => v.lang.startsWith('en')));
    if (preferred) utt.voice = preferred;

    utt.onstart = () => setIsSpeaking(true);
    utt.onend   = () => { setIsSpeaking(false); onEnd?.(); };
    utt.onerror = () => { setIsSpeaking(false); onEnd?.(); };

    synthRef.current.speak(utt);
  }, [autoSpeak, stopSpeaking, language, speechRate, speechPitch, selectedVoiceName]);

  // ── STT ─────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (isLoading || isSpeaking) return;
    stopSpeaking();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.lang            = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognitionRef.current = rec;

    let finalText = '';

    rec.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setVoiceStatus('Listening… speak now');
    };

    rec.onresult = (e: any) => {
      let interim = '';
      finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setTranscript(finalText || interim);
    };

    rec.onend = () => {
      setIsListening(false);
      setTranscript('');
      setVoiceStatus('');
      if (finalText.trim()) sendMessage(finalText.trim(), true);
    };

    rec.onerror = (e: any) => {
      setIsListening(false);
      setTranscript('');
      if (e.error === 'not-allowed') {
        setVoiceStatus('Mic access denied. Please allow microphone.');
        setVoiceMode(false);
      } else if (e.error === 'no-speech') {
        setVoiceStatus('No speech detected. Try again.');
      } else {
        setVoiceStatus(`Error: ${e.error}`);
      }
      setTimeout(() => setVoiceStatus(''), 3000);
    };

    try { rec.start(); } catch(e) { console.error(e); }
  }, [isLoading, isSpeaking, language]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ── Report generation ────────────────────────────────────────────────────
  // Tries to fulfil a report request locally (faster + no Gemini quota use).
  // Returns the success message string if a PDF was generated, null otherwise.
  const runReportIntent = useCallback(async (text: string): Promise<string | null> => {
    const intent = detectReportIntent(text);
    if (!intent) return null;
    const ctx: any = appContext || {};
    const employees = ctx.employees || [];
    const attendance = ctx.attendanceRecords || [];
    const holidays = ctx.holidays || [];
    const payroll = ctx.payrollData || [];
    const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][intent.month ?? new Date().getMonth()];
    try {
      switch (intent.type) {
        case 'monthly_attendance':
        case 'summary': {
          const file = await generateMonthlyAttendancePDF(intent.month!, intent.year!, employees, attendance, holidays);
          return 'Generated monthly attendance summary for ' + monthName + ' ' + intent.year + '. Saved as ' + file + '.';
        }
        case 'daily_punch': {
          const file = await generateDailyPunchPDF(intent.date!, employees, attendance);
          return 'Generated daily punch report for ' + intent.date + '. Saved as ' + file + '.';
        }
        case 'late_arrivals': {
          const file = await generateLateArrivalsPDF(intent.month!, intent.year!, employees, attendance);
          return 'Generated late arrivals report for ' + monthName + ' ' + intent.year + '. Saved as ' + file + '.';
        }
        case 'salary': {
          if (!payroll || payroll.length === 0) {
            return 'I can generate the salary PDF, but the payroll data is empty. Open the Payroll page so it computes for ' + monthName + ' ' + intent.year + ', then ask again.';
          }
          const file = await generateSalaryPDF(intent.month!, intent.year!, employees, payroll);
          return 'Generated salary report for ' + monthName + ' ' + intent.year + '. Saved as ' + file + '.';
        }
      }
      return null;
    } catch (err: any) {
      return 'PDF generation failed: ' + (err.message || 'unknown error') + '. Please try again.';
    }
  }, [appContext]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, isVoice = false) => {
    if (!text.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text, isVoice }]);
    setIsLoading(true);
    setVoiceStatus(isVoice ? 'ZenAI is thinking…' : '');

    try {
      // Fast path: if this is a clear report/PDF request, handle locally.
      const reportReply = await runReportIntent(text);
      if (reportReply) {
        setMessages(prev => [...prev, { role: 'model', text: reportReply }]);
        setVoiceStatus('');
        if (isVoice && voiceMode && autoSpeak) {
          speak(reportReply, () => { if (voiceMode) setTimeout(startListening, 600); });
        } else if (autoSpeak && voiceMode) {
          speak(reportReply);
        }
        return;
      }

      if (!chatRef.current) chatRef.current = createHRChat(appContext);
      // When user chose Hindi, append a one-line instruction so Gemini replies
      // in Hindi (Devanagari script). The legal-mode citations stay in English.
      const promptText = language === 'hi'
        ? text + '\n\n[कृपया हिन्दी (देवनागरी) में उत्तर दें। संख्याएं और अधिनियम/कोड नाम अंग्रेज़ी में रख सकते हैं।]'
        : text;
      const response = await chatRef.current.sendMessage({ message: promptText });
      const reply = response.text || (language === 'hi' ? 'मैं उत्तर नहीं दे सका।' : "I couldn't generate a response.");
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
      setVoiceStatus('');

      // Auto-speak reply — in voice mode loop back to mic, in text mode just speak
      if (isVoice && voiceMode && autoSpeak) {
        speak(reply, () => {
          if (voiceMode) setTimeout(startListening, 600);
        });
      } else if (autoSpeak) {
        speak(reply);
      }
    } catch (err) {
      const errMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages(prev => [...prev, { role: 'model', text: errMsg }]);
      setVoiceStatus('');
      if (isVoice && voiceMode) speak(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, appContext, voiceMode, autoSpeak, speak, startListening, runReportIntent, language]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    sendMessage(msg, false);
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
      setVoiceStatus('Voice mode on. Tap mic to speak.');
    }
  };

  const handleMicClick = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end select-none">

      {/* ── Chat Window ── */}
      {isOpen && (
        <div className="bg-white w-[380px] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-6 duration-300"
          style={{ height: voiceMode ? '520px' : '600px' }}>

          {/* Header */}
          <div className={`p-4 text-white flex items-center justify-between shadow-lg transition-all duration-500 ${voiceMode ? 'bg-gradient-to-r from-violet-700 via-indigo-600 to-indigo-700' : 'bg-indigo-600'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-400/30 animate-pulse' : isSpeaking ? 'bg-emerald-400/20 animate-pulse' : 'bg-white/15'}`}>
                <Bot size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  ZenAI Assistant
                  {voiceMode && (
                    <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                      VOICE
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest">
                  {isListening ? '🔴 Listening…' : isSpeaking ? '🔊 Speaking…' : isLoading ? '⏳ Thinking…' : autoSpeak ? '🔊 Voice On' : '🔇 Voice Off'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Language toggle (English / हिन्दी) — persists in localStorage */}
              <button
                onClick={() => {
                  const next = language === 'hi' ? 'en' : 'hi';
                  setLanguage(next);
                  try { window.localStorage.setItem('zenai_lang', next); } catch {}
                  if (isSpeaking) stopSpeaking();
                  if (chatRef.current && chatRef.current.clearHistory) chatRef.current.clearHistory();
                }}
                title={language === 'hi' ? 'Switch to English' : 'हिन्दी में बात करें'}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-black uppercase tracking-widest transition-all">
                {language === 'hi' ? 'हिन्दी' : 'EN'}
              </button>
              {/* Mute toggle — always visible so user can silence talk-back */}
              <button onClick={() => { setAutoSpeak(p => !p); if (isSpeaking) stopSpeaking(); }}
                title={autoSpeak ? 'Mute AI voice' : 'Unmute AI voice'}
                className={`p-1.5 rounded-lg transition-all ${autoSpeak ? 'bg-white/20 text-white' : 'bg-white/8 text-white/40'}`}>
                {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              {/* Voice settings button */}
              <button onClick={() => setShowVoiceSettings(p => !p)}
                title="Voice Settings"
                className={`p-1.5 rounded-lg transition-all ${showVoiceSettings ? 'bg-white/30 text-white' : 'bg-white/15 text-white/80 hover:bg-white/25'}`}>
                <Settings size={15} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <Minimize2 size={18} />
              </button>
            </div>
          </div>

          {/* Voice Status Bar */}
          {voiceMode && (
            <div className={`px-4 py-2 flex items-center justify-between border-b text-xs font-bold transition-all ${isListening ? 'bg-red-50 border-red-100 text-red-600' : isSpeaking ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-violet-50 border-violet-100 text-violet-700'}`}>
              <div className="flex items-center gap-2">
                {isListening && (
                  <div className="flex gap-0.5 items-end h-4">
                    {[1,2,3,4,3,2,1].map((h, i) => (
                      <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse"
                        style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }} />
                    ))}
                  </div>
                )}
                {isSpeaking && <Waves size={14} className="text-emerald-600 animate-pulse" />}
                <span>
                  {voiceStatus ||
                    (isListening ? 'Speak now…' :
                     isSpeaking  ? 'ZenAI is responding…' :
                     isLoading   ? 'Processing your request…' :
                     'Tap 🎤 to speak')}
                </span>
              </div>
              {isSpeaking && (
                <button onClick={stopSpeaking} className="text-red-500 hover:text-red-700 font-black text-[10px] px-2 py-0.5 bg-red-50 rounded-full border border-red-200 transition-all">
                  Stop ✕
                </button>
              )}
            </div>
          )}

          {/* ── Voice Settings Panel ── */}
          {showVoiceSettings && (
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-3 text-xs">
              <p className="font-black text-slate-500 uppercase tracking-widest text-[9px] flex items-center gap-1">
                <Settings size={9} /> Voice Settings
              </p>

              {/* Voice selector */}
              <div>
                <p className="font-bold text-slate-500 mb-1">Voice</p>
                <select
                  value={selectedVoiceName}
                  onChange={e => {
                    setSelectedVoiceName(e.target.value);
                    try { window.localStorage?.setItem('zenai_voice', e.target.value); } catch {}
                  }}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Auto (Best Available)</option>
                  {availableVoices.map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>

              {/* Speed */}
              <div>
                <p className="font-bold text-slate-500 mb-1">Speed</p>
                <div className="flex gap-1.5">
                  {[{label:'🐢 Slow', val:0.7},{label:'🚶 Normal', val:0.9},{label:'🏃 Fast', val:1.2},{label:'⚡ Very Fast', val:1.5}].map(s => (
                    <button key={s.val} onClick={() => {
                      setSpeechRate(s.val);
                      try { window.localStorage?.setItem('zenai_rate', String(s.val)); } catch {}
                    }}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[9px] border transition-all ${speechRate === s.val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch */}
              <div>
                <p className="font-bold text-slate-500 mb-1">Pitch</p>
                <div className="flex gap-1.5">
                  {[{label:'🔉 Low', val:0.7},{label:'🔊 Normal', val:1.0},{label:'🎵 High', val:1.3}].map(p => (
                    <button key={p.val} onClick={() => {
                      setSpeechPitch(p.val);
                      try { window.localStorage?.setItem('zenai_pitch', String(p.val)); } catch {}
                    }}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[9px] border transition-all ${speechPitch === p.val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test voice */}
           