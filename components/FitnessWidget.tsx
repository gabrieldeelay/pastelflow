
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

  // Sincroniza posição inicial vinda do perfil
  useEffect(() => {
    if (initialPosition) {
      setPosition(initialPosition);
    }
  }, [initialPosition]);

  // Garante que o widget inicie dentro da área visível
  useEffect(() => {
    const rescueWidget = () => {
      if (!widgetRef.current) return;
      const rect = widgetRef.current.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const margin = 30;

      setPosition(prev => {
        let nx = prev.x;
        let ny = prev.y;
        let changed = false;
        const w = 340; // Largura fixa
        const h = rect.height || 500;

        if (nx + w > winW) { nx = winW - w - margin; changed = true; }
        if (ny + h > winH) { ny = winH - h - margin; changed = true; }
        if (nx < margin) { nx = margin; changed = true; }
        if (ny < margin) { ny = margin; changed = true; }

        if (changed) {
          onLayoutChange(nx, ny);
          return { x: nx, y: ny };
        }
        return prev;
      });
    };
    const timer = setTimeout(rescueWidget, 200);
    window.addEventListener('resize', rescueWidget);
    return () => { clearTimeout(timer); window.removeEventListener('resize', rescueWidget); };
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
      // Uso direto da API KEY do ambiente conforme instruções
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise: "${input}". É um alimento? Se sim, retorne apenas o número médio de calorias. Se não for alimento (objetos, nomes, números aleatórios, termos sem sentido), retorne '0'.`,
        config: {
          systemInstruction: "Retorne EXCLUSIVAMENTE um número inteiro. Se o termo não for um alimento comestível claro, retorne 0. Nunca explique o motivo.",
          temperature: 0.1,
        }
      });

      const result = response.text?.trim() || "0";
      const val = parseInt(result.replace(/\D/g, '')) || 0;
      
      if (val > 0) {
        setFoodCals(val.toString());
      } else {
        setAiError(`"${input}" não identificado como alimento.`);
        setFoodCals('');
      }
    } catch (error: any) {
      console.error("Erro na Gemini API:", error);
      setAiError("IA indisponível no momento.");
    } finally {
      setIsEstimating(false);
    }
  };

  const waterMeta = WATER_GOALS[data?.waterGoal || 'recommended'];
  const waterPercent = Math.min(100, Math.round(((data?.waterConsumed || 0) / waterMeta.amount) * 100));

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
            {imcData.bmi > 0 && (
              <div className="bg-teal-50 rounded-2xl p-4 flex justify-between items-center border border-teal-100">
                <div className="flex flex-col"><span className="text-2xl font-black text-teal-700">{imcData.bmi.toFixed(1)}</span><span className="text-[9px] font-bold text-teal-600 uppercase tracking-widest">IMC</span></div>
                <div className="text-right text-xs font-bold text-stone-700">{imcData.status}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'water' && (
          <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in slide-in-from-right-4">
            <div className={`relative w-32 h-44 rounded-3xl border-4 ${waterMeta.border} overflow-hidden bg-stone-50 shadow-inner flex flex-col justify-end`}>
                <div className={`absolute bottom-0 w-full transition-all duration-1000 ease-out bg-blue-500`} style={{ height: `${waterPercent}%` }} />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-black text-stone-700 mix-blend-overlay">{waterPercent}%</span>
            </div>
            <div className="flex gap-4">
                <button onClick={() => updateData({ waterConsumed: Math.max(0, (data?.waterConsumed || 0) - 250) })} className="bg-white border border-stone-200 p-3 rounded-2xl hover:bg-red-50 text-red-400"><Minus /></button>
                <button onClick={() => updateData({ waterConsumed: (data?.waterConsumed || 0) + 250 })} className="bg-blue-500 text-white p-3 rounded-2xl hover:bg-blue-600 px-6 font-bold">+250ml</button>
            </div>
          </div>
        )}

        {activeTab === 'calories' && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4">
            <div className="bg-stone-800 text-white rounded-2xl p-5 shadow-lg relative">
                <div className="flex justify-between items-end mb-4">
                   <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-stone-400">Meta</span><span className="text-2xl font-black">{calorieBudget} kcal</span></div>
                   <div className="text-[10px] font-bold text-stone-400">Restam: {caloriesRemaining}</div>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${caloriePercent}%` }} /></div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input placeholder="Alimento..." value={foodName} onChange={e => { setFoodName(e.target.value); setAiError(null); }} className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm outline-none" />
                <div className="relative w-24">
                  <input type="number" placeholder="kcal" value={foodCals} onChange={e => setFoodCals(e.target.value)} className={`w-full bg-stone-50 border border-stone-200 rounded-xl p-2 pr-8 text-sm outline-none ${isEstimating ? 'animate-pulse' : ''}`} />
                  <button onClick={estimateCaloriesWithAI} disabled={isEstimating || !foodName.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-400">
                    {isEstimating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  </button>
                </div>
                <button onClick={addFood} className="bg-orange-500 text-white p-2 rounded-xl"><Plus /></button>
              </div>
              {aiError && <div className="text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertCircle size={10} /> {aiError}</div>}
              <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto">
                {data?.foodLog?.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-white border border-stone-100 p-2 px-3 rounded-xl text-xs">
                        <span className="font-bold">{item.name} ({item.calories} kcal)</span>
                        <button onClick={() => updateData({ foodLog: data.foodLog.filter(f => f.id !== item.id) })} className="text-stone-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
             {data?.history?.length ? data.history.map(h => (
               <div key={h.date} className="bg-white border border-stone-100 rounded-2xl p-4 text-xs">
                  <div className="flex justify-between mb-2"><span className="font-black text-stone-400">{h.date}</span><span className="font-bold">IMC {h.bmi.toFixed(1)}</span></div>
                  <div className="grid grid-cols-3 text-center font-bold">
                    <div>{h.weight}kg</div>
                    <div>{h.water/1000}L</div>
                    <div className="text-orange-500">{h.caloriesIn}kcal</div>
                  </div>
               </div>
             )) : <div className="text-center py-12 text-stone-300 font-bold italic">Sem histórico.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default FitnessWidget;
