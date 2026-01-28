
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, X, GripHorizontal, Droplets, Utensils, Dumbbell, 
  Plus, Minus, Info, Trash2, History, ChevronRight, Scale, ArrowRight,
  Waves, Award, CheckCircle2, Zap, RefreshCw, Sparkles, Loader2,
  Target, User, TrendingDown, TrendingUp, Equal, AlertCircle, Clock
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
  const [position, setPosition] = useState(initialPosition || { x: 50, y: 350 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'imc' | 'water' | 'calories' | 'history'>('imc');
  
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
    if (initialPosition) {
      setPosition(initialPosition);
    }
  }, [initialPosition]);

  useEffect(() => {
    const ensureVisible = () => {
      if (!widgetRef.current) return;
      
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const margin = 25;
      const w = 340;
      const h = widgetRef.current.offsetHeight || 500;

      setPosition(prev => {
        let nx = prev.x;
        let ny = prev.y;
        let changed = false;

        if (nx + w > winW) { nx = Math.max(margin, winW - w - margin); changed = true; }
        if (ny + h > winH) { ny = Math.max(margin, winH - h - margin); changed = true; }
        if (nx < margin) { nx = margin; changed = true; }
        if (ny < margin) { ny = margin; changed = true; }

        if (changed) {
          onLayoutChange(nx, ny);
          return { x: nx, y: ny };
        }
        return prev;
      });
    };

    const timer = setTimeout(ensureVisible, 300);
    window.addEventListener('resize', ensureVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', ensureVisible);
    };
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
    if (!weight || !height) return { bmi: 0, status: '' };
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
        const widgetWidth = 340;
        const widgetHeight = widgetRef.current?.offsetHeight || 500;
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

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise a entrada do usuário: "${input}". 
        REGRAS:
        1. Se for um alimento real, retorne APENAS o número médio de calorias.
        2. Se NÃO for um alimento comestível (ex: 'pedra', 'carro', números aleatórios como '523525', nomes de pessoas, objetos), retorne obrigatoriamente o dígito '0'.
        3. Nunca adicione texto, explicações ou unidades de medida. Retorne apenas o número bruto.`,
        config: {
          systemInstruction: "Você é um assistente nutricional rigoroso. Sua única saída permitida é um número inteiro. Se a entrada não fizer sentido como alimento, retorne 0.",
          temperature: 0.1,
        }
      });

      const resultText = response.text?.trim() || "0";
      const cleanedValue = resultText.replace(/[^0-9]/g, '');
      const val = parseInt(cleanedValue) || 0;
      
      if (val > 0) {
        setFoodCals(val.toString());
      } else {
        setAiError(`"${input}" não é um alimento reconhecido.`);
        setFoodCals('');
      }
    } catch (error: any) {
      console.error("Erro na Gemini API:", error);
      setAiError("IA offline. Tente novamente mais tarde.");
    } finally {
      setIsEstimating(false);
    }
  };

  const waterMeta = WATER_GOALS[data?.waterGoal || 'recommended'];
  const waterPercent = Math.min(100, Math.round(((data?.waterConsumed || 0) / waterMeta.amount) * 100));
  const waterRemaining = Math.max(0, waterMeta.amount - (data?.waterConsumed || 0));

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
               <div className="flex items-center gap-2 text-stone-500 mb-3"><User size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Seu Perfil</span></div>
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
            {imcData.bmi > 0 && (
              <div className="bg-teal-50 rounded-2xl p-4 flex justify-between items-center border border-teal-100">
                <div className="flex flex-col"><span className="text-2xl font-black text-teal-700">{imcData.bmi.toFixed(1)}</span><span className="text-[9px] font-bold text-teal-600 uppercase tracking-widest">IMC Estimado</span></div>
                <div className="text-right text-xs font-bold text-stone-700">{imcData.status}</div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Nível de Atividade</label>
              <div className="grid grid-cols-3 gap-2">
                 {Object.entries(ACTIVITY_LEVELS).map(([key, info]) => (
                   <button key={key} onClick={() => updateData({ activityLevel: key as any })} className={`p-2 rounded-xl border text-[9px] font-bold uppercase transition-all ${data?.activityLevel === key ? 'bg-stone-800 text-white border-stone-800 shadow-md' : 'bg-white text-stone-400 border-stone-100 hover:bg-stone-50'}`}>
                     {info.label}
                   </button>
                 ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'water' && (
          <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in slide-in-from-right-4">
            <div className="w-full">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 block text-center">Definir Meta</label>
              <div className="flex bg-stone-50 p-1 rounded-2xl border border-stone-100">
                 {Object.entries(WATER_GOALS).map(([key, info]) => (
                   <button 
                    key={key} 
                    onClick={() => updateData({ waterGoal: key as any })} 
                    className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all ${data?.waterGoal === key ? `${info.bg} text-white shadow-sm` : 'text-stone-400 hover:text-stone-600'}`}
                   >
                     {info.label}
                   </button>
                 ))}
              </div>
            </div>

            <div className={`relative w-32 h-44 rounded-3xl border-4 ${waterMeta.border} overflow-hidden bg-stone-50 shadow-inner flex flex-col justify-end transition-colors duration-500`}>
                <div className={`absolute bottom-0 w-full transition-all duration-1000 ease-out ${waterMeta.bg}`} style={{ height: `${waterPercent}%` }}>
                    <div className="absolute top-0 left-0 w-full h-2 bg-white/20 animate-pulse" />
                </div>
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-black text-stone-700 mix-blend-overlay z-10">{waterPercent}%</span>
                <Waves size={40} className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 animate-bounce" />
            </div>

            <div className="text-center">
               <p className={`text-xl font-black ${waterMeta.color}`}>{(data?.waterConsumed || 0) / 1000}L <span className="text-xs text-stone-300">/ {waterMeta.amount / 1000}L</span></p>
               <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
                 {waterRemaining > 0 ? `Faltam ${waterRemaining / 1000}L para a meta` : 'Meta batida! Parabéns! 🎉'}
               </p>
            </div>

            <div className="flex gap-4">
                <button onClick={() => updateData({ waterConsumed: Math.max(0, (data?.waterConsumed || 0) - 250) })} className="bg-white border border-stone-200 p-3 rounded-2xl hover:bg-red-50 text-red-400 transition-all active:scale-90"><Minus /></button>
                <button onClick={() => updateData({ waterConsumed: (data?.waterConsumed || 0) + 250 })} className={`${waterMeta.bg} text-white p-3 rounded-2xl hover:brightness-110 px-8 font-bold tracking-tight shadow-lg transition-all active:scale-95 flex items-center gap-2`}>
                   <Droplets size={18} />
                   +250ml
                </button>
            </div>
          </div>
        )}

        {activeTab === 'calories' && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4">
            <div className="bg-stone-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                   <Target size={64} />
                </div>
                <div className="flex justify-between items-end mb-4 relative z-10">
                   <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Meta Diária</span><span className="text-2xl font-black">{calorieBudget} kcal</span></div>
                   <div className="text-right flex flex-col items-end">
                      <span className={`text-xs font-bold ${caloriesRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {caloriesRemaining < 0 ? `Excedido: ${Math.abs(caloriesRemaining)}` : `Restam: ${caloriesRemaining}`}
                      </span>
                   </div>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full relative z-10"><div className="h-full bg-orange-500 rounded-full transition-all duration-700" style={{ width: `${caloriePercent}%` }} /></div>
            </div>

            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
               <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-orange-600">
                     <Dumbbell size={16} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Treino</span>
                  </div>
                  <span className="text-[10px] font-bold text-orange-400">-{caloriesOut} kcal</span>
               </div>
               <div className="relative">
                  <input type="number" placeholder="Minutos de treino..." value={data?.workoutMinutes || ''} onChange={e => updateData({ workoutMinutes: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-stone-200 rounded-xl p-3 pl-10 text-sm outline-none focus:border-orange-300" />
                  <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-300" />
               </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                 <Utensils size={14} /> Refeições
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input placeholder="Ex: Maçã, Pizza..." value={foodName} onChange={e => { setFoodName(e.target.value); setAiError(null); }} className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm outline-none focus:border-stone-400 transition-all" />
                <div className="flex gap-2">
                  <div className="relative w-40">
                    <input type="number" placeholder="kcal" value={foodCals} onChange={e => setFoodCals(e.target.value)} className={`w-full bg-stone-50 border border-stone-200 rounded-xl p-3 pr-10 text-sm outline-none focus:border-stone-400 font-bold ${isEstimating ? 'animate-pulse' : ''}`} />
                    <button onClick={estimateCaloriesWithAI} disabled={isEstimating || !foodName.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 hover:text-orange-600 transition-colors">
                      {isEstimating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                  <button onClick={addFood} className="bg-orange-500 text-white p-3 rounded-xl hover:bg-orange-600 active:scale-95 transition-all shadow-md"><Plus size={20} /></button>
                </div>
              </div>
              {aiError && <div className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-in fade-in slide-in-from-top-1"><AlertCircle size={10} /> {aiError}</div>}
              <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                {data?.foodLog?.length ? data.foodLog.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-white border border-stone-100 p-2 px-3 rounded-xl text-xs shadow-sm group">
                        <span className="font-bold text-stone-700">{item.name} <span className="text-stone-400 font-normal">({item.calories} kcal)</span></span>
                        <button onClick={() => updateData({ foodLog: data.foodLog.filter(f => f.id !== item.id) })} className="text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                    </div>
                )) : <div className="text-center py-6 text-stone-300 text-[10px] italic border border-dashed border-stone-200 rounded-xl">Sem registros de hoje.</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
             {data?.history?.length ? data.history.map(h => (
               <div key={h.date} className="bg-white border border-stone-100 rounded-2xl p-4 text-xs shadow-sm hover:border-stone-200 transition-colors">
                  <div className="flex justify-between mb-2"><span className="font-black text-stone-400 uppercase tracking-widest">{new Date(h.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span><span className="font-bold text-stone-600 px-2 py-0.5 bg-stone-100 rounded-full">IMC {h.bmi.toFixed(1)}</span></div>
                  <div className="grid grid-cols-3 text-center font-bold">
                    <div className="flex flex-col"><span className="text-[8px] text-stone-300 font-black mb-1">PESO</span>{h.weight}kg</div>
                    <div className="flex flex-col"><span className="text-[8px] text-stone-300 font-black mb-1">ÁGUA</span>{h.water/1000}L</div>
                    <div className="flex flex-col text-orange-500"><span className="text-[8px] text-stone-300 font-black mb-1">CAL.</span>{h.caloriesIn}</div>
                  </div>
               </div>
             )) : <div className="text-center py-12 text-stone-300 font-bold italic border-2 border-dashed border-stone-100 rounded-3xl">Seu progresso diário aparecerá aqui.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default FitnessWidget;
