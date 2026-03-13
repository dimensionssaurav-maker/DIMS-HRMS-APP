import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, X, Send, Bot, User, Loader2, Minimize2,
  Mic, MicOff, Volume2, VolumeX, Waves, ChevronDown
} from 'lucide-react';
import { createHRChat } from '../services/geminiService';

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
        voicesRef.current = window.speechSynthesis.getVoices();
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
    utt.lang = 'en-IN';
    utt.rate = 0.95;
    utt.pitch = 1.05;
    utt.volume = 1;

    // Pick best voice
    const voices = voicesRef.current;
    const preferred =
      voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang === 'en-IN') ||
      voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;

    utt.onstart = () => setIsSpeaking(true);
    utt.onend   = () => { setIsSpeaking(false); onEnd?.(); };
    utt.onerror = () => { setIsSpeaking(false); onEnd?.(); };

    synthRef.current.speak(utt);
  }, [autoSpeak, stopSpeaking]);

  // ── STT ─────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (isLoading || isSpeaking) return;
    stopSpeaking();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.lang            = 'en-IN';
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
  }, [isLoading, isSpeaking]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, isVoice = false) => {
    if (!text.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text, isVoice }]);
    setIsLoading(true);
    setVoiceStatus(isVoice ? 'ZenAI is thinking…' : '');

    try {
      if (!chatRef.current) chatRef.current = createHRChat(appContext);
      const response = await chatRef.current.sendMessage({ message: text });
      const reply = response.text || "I couldn't generate a response.";
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
      setVoiceStatus('');

      // Auto-speak reply in voice mode
      if (isVoice && voiceMode && autoSpeak) {
        speak(reply, () => {
          // Auto-listen again after speaking
          if (voiceMode) setTimeout(startListening, 600);
        });
      } else if (autoSpeak && voiceMode) {
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
  }, [isLoading, appContext, voiceMode, autoSpeak, speak, startListening]);

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
                  {isListening ? '🔴 Listening…' : isSpeaking ? '🔊 Speaking…' : isLoading ? '⏳ Thinking…' : 'Live AI Support'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mute toggle */}
              {voiceMode && (
                <button onClick={() => { setAutoSpeak(p => !p); if (isSpeaking) stopSpeaking(); }}
                  title={autoSpeak ? 'Mute AI' : 'Unmute AI'}
                  className={`p-1.5 rounded-lg transition-all ${autoSpeak ? 'bg-white/20 text-white' : 'bg-white/8 text-white/40'}`}>
                  {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
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

          {/* Messages */}
          {!voiceMode && (
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      {msg.role === 'model' && (
                        <button onClick={() => speak(msg.text)}
                          className={`mt-1.5 text-[10px] flex items-center gap-1 font-bold transition-colors ${msg.role === 'model' ? 'text-indigo-300 hover:text-indigo-500' : ''}`}>
                          <Volume2 size={10} /> Replay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Live transcript */}
              {isListening && transcript && (
                <div className="flex justify-end">
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-600 text-sm px-4 py-2 rounded-2xl rounded-tr-none max-w-[88%] italic animate-pulse">
                    "{transcript}"
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2 items-center bg-white text-slate-400 p-3 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                    <span className="text-xs font-medium">ZenAI is thinking…</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice Mode — Big Mic UI */}
          {voiceMode && (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 gap-6">

              {/* Animated mic ring */}
              <div className="relative flex items-center justify-center">
                {/* Outer pulse rings when listening */}
                {isListening && (
                  <>
                    <div className="absolute w-32 h-32 rounded-full bg-red-400/20 animate-ping" />
                    <div className="absolute w-28 h-28 rounded-full bg-red-400/15 animate-ping" style={{ animationDelay: '200ms' }} />
                  </>
                )}
                {isSpeaking && (
                  <>
                    <div className="absolute w-32 h-32 rounded-full bg-emerald-400/20 animate-ping" />
                    <div className="absolute w-28 h-28 rounded-full bg-emerald-400/15 animate-ping" style={{ animationDelay: '300ms' }} />
                  </>
                )}

                {/* Mic button */}
                <button onClick={handleMicClick} disabled={isLoading || isSpeaking}
                  className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
                    isListening ? 'bg-red-500 shadow-red-200 scale-110' :
                    isSpeaking  ? 'bg-emerald-500 shadow-emerald-200' :
                    'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 shadow-indigo-200'
                  }`}>
                  {isListening
                    ? <MicOff size={36} />
                    : isSpeaking
                    ? <Volume2 size={36} className="animate-pulse" />
                    : <Mic size={36} />}
                </button>
              </div>

              {/* Status text */}
              <div className="text-center space-y-1">
                <p className="font-black text-slate-700 text-base">
                  {isListening ? 'Listening…' :
                   isSpeaking  ? 'ZenAI is Speaking' :
                   isLoading   ? 'Processing…' :
                   'Tap to Speak'}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  {isListening ? 'Release to send' :
                   isSpeaking  ? 'Tap Stop to interrupt' :
                   'ZenAI will respond by voice'}
                </p>
              </div>

              {/* Last message preview in voice mode */}
              {messages.length > 1 && (
                <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-3 max-h-28 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Bot size={10} /> Last Response
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {messages.filter(m => m.role === 'model').slice(-1)[0]?.text.slice(0, 180)}
                    {(messages.filter(m => m.role === 'model').slice(-1)[0]?.text.length || 0) > 180 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* Type fallback in voice mode */}
              <div className="w-full flex gap-2">
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Or type a message…"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                <button onClick={handleSend} disabled={!input.trim() || isLoading}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-all">
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Text input (non-voice mode) */}
          {!voiceMode && (
            <div className="p-3 bg-white border-t border-slate-100">
              <div className="flex gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-400 transition-all">
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about payroll, attendance, employees…"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-slate-700" />
                <button onClick={handleSend} disabled={isLoading || !input.trim()}
                  className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm shadow-indigo-100">
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Footer bar */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[9px] text-slate-400 font-medium">Powered by Gemini • DIMS HRMS</p>
            {voiceReady ? (
              <button onClick={toggleVoiceMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                  voiceMode
                    ? 'bg-violet-100 text-violet-700 border-violet-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200'
                }`}>
                {voiceMode ? <MicOff size={11} /> : <Mic size={11} />}
                {voiceMode ? 'Exit Voice' : '🎤 Voice Mode'}
              </button>
            ) : (
              <span className="text-[9px] text-slate-300">Voice not supported</span>
            )}
          </div>
        </div>
      )}

      {/* Toggle FAB */}
      <button onClick={() => setIsOpen(p => !p)}
        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 active:scale-95 ${
          isOpen ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}>
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-white" />
          </div>
        )}
        {!isOpen && isListening && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white" />
          </div>
        )}
      </button>
    </div>
  );
};

export default AIChatBot;
