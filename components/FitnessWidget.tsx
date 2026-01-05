
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, X, GripHorizontal, Droplets, Utensils, Dumbbell, 
  Plus, Minus, Info, Trash2, History, ChevronRight, Scale, ArrowRight,
  Waves, Award, CheckCircle2, Zap, RefreshCw, Sparkles, Loader2,
  Target, User, TrendingDown, TrendingUp, Equal, AlertCircle
} from 'lucide-react';
import { FitnessData, FitnessHistoryEntry } from '../types';
import { GoogleGenAI } from "@google/genai";

interface Props {
  data: FitnessData | undefined;
  onUpdate: (data: FitnessData) => void;
  onRemove: () => void;
  initialPosition?: { x: number; y: number };
  onLayoutChange: (x: number, y: number) => void;
}

const WATER_GOALS = {
  easy: { label: 'Fácil', amount: 2000, color: 'text-teal-500', bg: 'bg-teal-500', light: 'bg-teal-50', border: 'border-teal-200' },
  recommended: { label: 'Recomendado', amount: 3000, color: 'text-blue-500', bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-200' },
  athlete: { label: 'Atleta', amount: 4500, color: 'text-indigo-500', bg: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200' }
};

const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentário', factor: 1.2 },
  light: { label: 'Leve', factor: 1.375 },
  moderate: { label: 'Moderado', factor: 1.55 },
  active: { label: 'Ativo', factor: 1.725 },
  very_active: { label: 'Intenso', factor: 1.9 }
};

const FITNESS_GOALS = {
  lose: { label: 'Emagrecer', adjustment: -500, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
  maintain: { label: 'Manter', adjustment: 0, icon: Equal, color: 'text-blue-500', bg: 'bg-blue-50' },
  gain: { label: 'Ganhar Massa', adjustment: 500, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' }
};

const FitnessWidget: React.FC<Props> = ({ data, onUpdate, onRemove, initialPosition, onLayoutChange }) => {
  const [position, setPosition] = useState(initialPosition || { x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'imc' | 'water' | 'calories' | 'history'>('imc');
  
  // Local Form State
  const [weight, setWeight] = useState(data?.weight || 0);
  const [height, setHeight] = useState(data?.height || 0);
  const [age, setAge] = useState(data?.age || 25);
  const [gender, setGender] = useState<'male' | 'female'>(data?.gender || 'male');
  
  const [foodName, setFoodName] = useState('');
  const [foodCals, setFoodCals] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (initialPosition) setPosition(initialPosition);
  }, [initialPosition]);

  useEffect(() => {
    const ensureVisible = () => {
      if (!widgetRef.current) return;
      const rect = widgetRef.current.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const margin = 20;

      setPosition(prev => {
        let nextX = prev.x;
        let nextY = prev.y;
        let corrected = false;
        const w = rect.width || 340;
        const h = rect.height || 400;

        if (nextX + w > winW) { nextX = Math.max(margin, winW - w - margin); corrected = true; }
        if (nextY + h > winH) { nextY = Math.max(margin, winH - h - margin); corrected = true; }
        if (nextX < 0) { nextX = margin; corrected = true; }
        if (nextY < 0) { nextY = margin; corrected = true; }

        if (corrected) {
          onLayoutChange(nextX, nextY);
          return { x: nextX, y: nextY };
        }
        return prev;
      });
    };
    const timer = setTimeout(ensureVisible, 150);
    window.addEventListener('resize', ensureVisible);
    return () => { clearTimeout(timer); window.removeEventListener('resize', ensureVisible); };
  }, [onLayoutChange]);

  useEffect(() => {
    if (data) {
      setWeight(data.weight);
      setHeight(data.height);
      setAge(data.age || 25);
      setGender(data.gender || 'male');
    }
  }, [data?.weight, data?.height, data?.age, data?.gender]);

  const imcData = useMemo(() => {
    if (!weight || !height) return { bmi: 0, status: '', diff: 0 };
    const hMeter = height / 100;
    const bmiVal = weight / (hMeter * hMeter);
    let status = bmiVal < 18.5 ? 'Abaixo do peso' : bmiVal > 24.9 ? 'Acima do peso' : 'Peso ideal';
    return { bmi: bmiVal, status };
  }, [weight, height]);

  const calorieBudget = useMemo(() => {
    if (!weight || !height || !age) return 0;
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = gender === 'male' ? bmr + 5 : bmr - 161;
    const activityFactor = ACTIVITY_LEVELS[data?.activityLevel || 'moderate'].factor;
    const tdee = bmr * activityFactor;
    const goalAdjustment = FITNESS_GOALS[data?.fitnessGoal || 'maintain'].adjustment;
    return Math.round(tdee + goalAdjustment);
  }, [weight, height, age, gender, data?.activityLevel, data?.fitnessGoal]);

  const caloriesIn = data?.foodLog.reduce((acc, curr) => acc + curr.calories, 0) || 0;
  const caloriesOut = (data?.workoutMinutes || 0) * 8; 
  const currentNetCalories = caloriesIn - caloriesOut;
  const caloriesRemaining = calorieBudget - currentNetCalories;
  const caloriePercent = calorieBudget > 0 ? Math.min(100, Math.round((currentNetCalories / calorieBudget) * 100)) : 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const rawX = e.clientX - dragOffset.current.x;
        const rawY = e.clientY - dragOffset.current.y;
        const widgetWidth = widgetRef.current?.offsetWidth || 340;
        const widgetHeight = widgetRef.current?.offsetHeight || 400;
        const maxX = window.innerWidth - widgetWidth;
        const maxY = window.innerHeight - widgetHeight;
        setPosition({ x: Math.max(0, Math.min(rawX, maxX)), y: Math.max(0, Math.min(rawY, maxY)) });
      }
    };
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onLayoutChange(position.x, position.y);
      }
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, onLayoutChange]);

  const updateData = (updates: Partial<FitnessData>) => {
    const defaultData: FitnessData = {
      weight, height, age, gender,
      activityLevel: 'moderate', fitnessGoal: 'maintain', waterGoal: 'recommended',
      waterConsumed: 0, workoutMinutes: 0, foodLog: [],
      lastUpdate: new Date().toISOString(), history: []
    };
    onUpdate({ ...(data || defaultData), ...updates });
  };

  const addFood = () => {
    if (!foodName || !foodCals) return;
    const newItem = { id: crypto.randomUUID(), name: foodName, calories: parseInt(foodCals) || 0 };
    updateData({ foodLog: [...(data?.foodLog || []), newItem] });
    setFoodName('');
    setFoodCals('');
    setAiError(null);
  };

  const estimateCaloriesWithAI = async () => {
    const input = foodName.trim();
    if (!input || isEstimating) return;
    
    setIsEstimating(true);
    setAiError(null);

    // Verificação de segurança para o ambiente de execução
    const apiKey = typeof process !== 'undefined' ? process.env?.API_KEY : null;
    
    if (!apiKey) {
      console.error("ERRO: API_KEY não encontrada no ambiente (process.env.API_KEY).");
      setAiError("Chave de IA não configurada.");
      setIsEstimating(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise o termo: "${input}". Se for um alimento, responda APENAS o número médio de calorias para uma porção padrão. Se NÃO for um alimento (ex: objetos, nomes, números sem contexto, termos aleatórios como 'pedra'), responda apenas o dígito '0'.`,
        config: {
          systemInstruction: "Você é um classificador nutricional ultra-objetivo. Você deve retornar EXCLUSIVAMENTE um número inteiro. Nunca responda com texto ou explicações. Sua prioridade é identificar se a entrada é um alimento real. Caso contrário, retorne 0.",
          temperature: 0.1,
        }
      });

      const result = response.text?.trim() || "0";
      const calorieMatch = result.match(/\d+/);
      const val = calorieMatch ? parseInt(calorieMatch[0]) : 0;
      
      if (val > 0) {
        setFoodCals(val.toString());
      } else {
        setAiError(`"${input}" não é um alimento válido.`);
        setFoodCals('');
      }
    } catch (error: any) {
      console.error("Erro detalhado na conexão com Gemini API:", error);
      setAiError("Falha na conexão com o serviço de IA.");
    } finally {
      setIsEstimating(false);
    }
  };

  const waterGoalKey = data?.waterGoal || 'recommended';
  const waterMeta = WATER_GOALS[waterGoalKey];
  const waterPercent = Math.min(100, Math.round(((data?.waterConsumed || 0) / waterMeta.amount) * 100));
  const isWaterGoalReached = (data?.waterConsumed || 0) >= waterMeta.amount;

  return (
    <div 
      ref={widgetRef}
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 45, width: 340 }}
      className="bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col group animate-in fade-in zoom-in-95"
    >
      <div onMouseDown={handleMouseDown} className="p-2 flex items-center justify-between cursor-grab active:cursor-grabbing border-b shrink-0 bg-stone-50 border-stone-100">
        <div className="flex items-center gap-2 font-bold text-xs uppercase px-2 text-stone-500">
            <Activity size={14} />
            <span>Saúde & Fitness</span>
        </div>
        <div className="flex items-center gap-1">
            <GripHorizontal size={16} className="text-stone-300" />
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-full transition-colors">
                <X size={14} />
            </button>
        </div>
      </div>

      <div className="flex border-b border-stone-100 bg-stone-50/30">
        {['imc', 'water', 'calories', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-stone-800 border-b-2 border-stone-800' : 'text-stone-400'}`}>
            {tab === 'imc' ? 'Perfil' : tab === 'water' ? 'Água' : tab === 'calories' ? 'Dieta' : 'Hist.'}
          </button>
        ))}
      </div>

      <div className="p-5 min-h-[400px] max-h-[520px] overflow-y-auto custom-scrollbar">
        {activeTab === 'imc' && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4">
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
               <div className="flex items-center gap-2 text-stone-500 mb-3"><User size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Perfil</span></div>
               <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex bg-white rounded-xl border border-stone-200 overflow-hidden">
                     <button onClick={() => { setGender('male'); updateData({ gender: 'male' }); }} className={`flex-1 py-1.5 text-[10px] font-bold ${gender === 'male' ? 'bg-blue-500 text-white' : 'text-stone-400 hover:bg-stone-50'}`}>Masc.</button>
                     <button onClick={() => { setGender('female'); updateData({ gender: 'female' }); }} className={`flex-1 py-1.5 text-[10px] font-bold ${gender === 'female' ? 'bg-pink-500 text-white' : 'text-stone-400 hover:bg-stone-50'}`}>Fem.</button>
                  </div>
                  <div className="relative">
                    <input type="number" value={age} onChange={e => setAge(parseInt(e.target.value) || 0)} onBlur={() => updateData({ age })} className="w-full bg-white border border-stone-200 rounded-xl p-1.5 px-3 text-xs outline-none focus:border-stone-400" placeholder="Idade" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-300 uppercase">Anos</span>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] font-black text-stone-400 uppercase mb-1 block">Peso (kg)</label><input type="number" value={weight || ''} onChange={e => setWeight(parseFloat(e.target.value))} onBlur={() => updateData({ weight })} className="w-full bg-white border border-stone-200 rounded-xl p-1.5 px-3 text-xs outline-none focus:border-stone-400" /></div>
                  <div><label className="text-[9px] font-black text-stone-400 uppercase mb-1 block">Altura (cm)</label><input type="number" value={height || ''} onChange={e => setHeight(parseFloat(e.target.value))} onBlur={() => updateData({ height })} className="w-full bg-white border border-stone-200 rounded-xl p-1.5 px-3 text-xs outline-none focus:border-stone-400" /></div>
               </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Atividade</label>
              <div className="grid grid-cols-3 gap-2">
                 {Object.entries(ACTIVITY_LEVELS).map(([key, info]) => (
                   <button key={key} onClick={() => updateData({ activityLevel: key as any })} className={`p-2 rounded-xl border text-[9px] font-bold uppercase transition-all ${data?.activityLevel === key ? 'bg-teal-500 text-white border-teal-600 shadow-sm' : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'}`}>
                     {info.label}
                   </button>
                 ))}
              </div>
            </div>

            {imcData.bmi > 0 && (
              <div className="bg-teal-50 rounded-2xl p-4 flex justify-between items-center border border-teal-100">
                <div className="flex flex-col"><span className="text-2xl font-black text-teal-700">{imcData.bmi.toFixed(1)}</span><span className="text-[9px] font-bold text-teal-600 uppercase tracking-widest">IMC Atual</span></div>
                <div className="text-right"><p className="text-xs font-bold text-stone-700">{imcData.status}</p><p className="text-[10px] text-stone-500">Meta: {calorieBudget} kcal/dia</p></div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'water' && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-center py-4 relative">
              <div className={`relative w-32 h-44 rounded-3xl border-4 ${waterMeta.border} overflow-hidden bg-stone-50 shadow-inner flex flex-col justify-end transition-colors duration-500`}>
                <div className={`absolute bottom-0 w-full transition-all duration-1000 ease-out flex flex-col justify-center items-center ${waterMeta.bg}`} style={{ height: `${waterPercent}%` }}>
                    {waterPercent > 15 && <span className="text-white font-black text-xl drop-shadow-md">{waterPercent}%</span>}
                </div>
                {!isWaterGoalReached && <Waves size={48} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-stone-200 opacity-30" />}
              </div>
              <div className="mt-6 flex flex-col items-center gap-1">
                 <p className={`text-xl font-black ${waterMeta.color}`}>{(data?.waterConsumed || 0) / 1000}L <span className="text-xs text-stone-400">/ {waterMeta.amount / 1000}L</span></p>
                 {isWaterGoalReached ? <div className="flex items-center gap-1 text-green-500 font-black text-[10px] uppercase tracking-widest animate-pulse"><CheckCircle2 size={12} /><span>Meta Concluída!</span></div> : <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Ainda faltam {(waterMeta.amount - (data?.waterConsumed || 0)) / 1000}L</p>}
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => updateData({ waterConsumed: Math.max(0, (data?.waterConsumed || 0) - 250) })} className="bg-white border border-stone-200 p-3 rounded-2xl hover:bg-red-50 text-red-400 shadow-sm transition-all active:scale-90"><Minus size={20} /></button>
                <button onClick={() => updateData({ waterConsumed: (data?.waterConsumed || 0) + 250 })} className={`${waterMeta.bg} border p-3 rounded-2xl hover:brightness-110 text-white shadow-lg transition-all active:scale-90 flex items-center gap-2 px-6`}><Plus size={20} /><span className="font-bold text-xs uppercase">+250ml</span></button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calories' && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4">
            <div className="bg-stone-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Diário</span><span className="text-2xl font-black">{calorieBudget} <span className="text-xs text-stone-400">kcal</span></span></div>
                      <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase">{FITNESS_GOALS[data?.fitnessGoal || 'maintain'].label}</div>
                   </div>
                   <div className="h-2 w-full bg-white/10 rounded-full mb-2"><div className={`h-full rounded-full transition-all duration-700 ${currentNetCalories > calorieBudget ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${caloriePercent}%` }} /></div>
                   <div className="flex justify-between text-[10px] font-bold text-stone-400"><span>{currentNetCalories}kcal</span><span className={caloriesRemaining < 0 ? 'text-red-400' : 'text-green-400'}>{caloriesRemaining < 0 ? `Restam: ${caloriesRemaining}` : `Excedido: ${Math.abs(caloriesRemaining)}`}</span></div>
                </div>
            </div>

            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
              <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2 text-orange-600"><Dumbbell size={16} /><span className="text-xs font-black uppercase tracking-tighter">Atividade Física</span></div><div className="bg-white px-2 py-1 rounded-lg border border-orange-100 text-[10px] font-black text-orange-600">-{caloriesOut} kcal</div></div>
              <div className="relative"><input type="number" placeholder="Minutos" value={data?.workoutMinutes || ''} onChange={e => updateData({ workoutMinutes: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-stone-200 rounded-xl p-2 pl-8 text-sm outline-none focus:border-orange-300" /><Zap size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-300" /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-stone-500"><Utensils size={14} /><span className="text-xs font-black uppercase tracking-tighter">Dieta</span></div><div className="text-[10px] font-black text-stone-400">+{caloriesIn} kcal</div></div>
              <div className="flex flex-col gap-2 mb-4 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                {data?.foodLog && data.foodLog.length > 0 ? data.foodLog.map(item => (
                    <div key={item.id} className="group flex items-center justify-between bg-white border border-stone-100 p-2 pl-3 rounded-xl text-xs shadow-sm hover:border-orange-200 transition-all">
                      <div className="flex flex-col"><span className="font-bold text-stone-700">{item.name}</span><span className="text-[9px] text-stone-400 uppercase">{item.calories} kcal</span></div>
                      <button onClick={() => updateData({ foodLog: (data?.foodLog || []).filter(f => f.id !== item.id) })} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  )) : <div className="flex flex-col items-center justify-center py-6 text-stone-300 border-2 border-dashed border-stone-100 rounded-2xl"><Utensils size={24} className="mb-1 opacity-50" /><p className="text-[10px] font-bold">Sem registros.</p></div>}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input placeholder="Alimento..." value={foodName} onChange={e => { setFoodName(e.target.value); setAiError(null); }} className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm outline-none focus:border-orange-300" />
                  <div className="relative w-24">
                    <input type="number" placeholder="kcal" value={foodCals} onChange={e => setFoodCals(e.target.value)} className={`w-full bg-stone-50 border border-stone-200 rounded-xl p-2 pr-8 text-sm outline-none focus:border-orange-300 ${isEstimating ? 'animate-pulse' : ''}`} />
                    <button onClick={estimateCaloriesWithAI} disabled={isEstimating || !foodName.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-400 hover:text-orange-600 disabled:opacity-30">
                      {isEstimating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </button>
                  </div>
                  <button onClick={addFood} className="bg-orange-500 text-white p-2 rounded-xl hover:bg-orange-600 transition-all shadow-md active:scale-95"><Plus size={20} /></button>
                </div>
                {aiError && <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold mt-1 animate-in fade-in slide-in-from-top-1"><AlertCircle size={10} /> {aiError}</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            {data?.history && data.history.length > 0 ? data.history.map((entry) => (
                <div key={entry.date} className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm relative">
                    <button onClick={() => updateData({ history: data.history.filter(h => h.date !== entry.date) })} className="absolute top-2 right-2 p-1 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    <div className="flex justify-between items-center mb-3"><span className="text-[10px] font-black text-stone-400 uppercase">{new Date(entry.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span><span className="text-[10px] font-black bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">IMC {entry.bmi.toFixed(1)}</span></div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="flex flex-col"><span className="text-[8px] text-stone-400 uppercase font-black">Peso</span><span className="text-xs font-black text-stone-700">{entry.weight}kg</span></div>
                        <div className="flex flex-col"><span className="text-[8px] text-stone-400 uppercase font-black">Água</span><span className="text-xs font-black text-blue-500">{entry.water / 1000}L</span></div>
                        <div className="flex flex-col"><span className="text-[8px] text-stone-400 uppercase font-black">Cal.</span><span className={`text-xs font-black ${entry.caloriesIn > (entry.targetCalorie || 2000) ? 'text-red-500' : 'text-green-500'}`}>{entry.caloriesIn}</span></div>
                    </div>
                </div>
            )) : <div className="flex flex-col items-center justify-center py-12 text-stone-300 border-2 border-dashed border-stone-100 rounded-2xl"><History size={32} className="mb-2 opacity-50" /><p className="text-xs font-bold">Sem histórico.</p></div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default FitnessWidget;
