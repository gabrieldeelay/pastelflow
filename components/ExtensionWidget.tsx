
import React, { useState, useEffect, useRef } from 'react';
import { 
  Link as LinkIcon, X, GripHorizontal, Plus, Globe, Search, Mail, Code, 
  Video, Music, Image, ShoppingCart, MessageCircle, Zap, Trash2, Pencil, ExternalLink, AlertCircle
} from 'lucide-react';
import { ExtensionShortcut } from '../types';

interface Props {
  shortcuts: ExtensionShortcut[];
  onUpdateShortcuts: (shortcuts: ExtensionShortcut[]) => void;
  onRemove: () => void;
  initialPosition?: { x: number; y: number };
  onLayoutChange: (x: number, y: number) => void;
}

const ICONS = {
  'globe': Globe,
  'search': Search,
  'mail': Mail,
  'code': Code,
  'video': Video,
  'music': Music,
  'image': Image,
  'shopping-cart': ShoppingCart,
  'message-circle': MessageCircle,
  'zap': Zap
};

type IconKey = keyof typeof ICONS;

const ExtensionWidget: React.FC<Props> = ({ shortcuts, onUpdateShortcuts, onRemove, initialPosition, onLayoutChange }) => {
  const [position, setPosition] = useState(initialPosition || { x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Editor State
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formIcon, setFormIcon] = useState<IconKey>('globe');

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // --- SAFETY BOUNDS CHECK ---
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
            const w = rect.width || 320;
            const h = rect.height || 200;

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
    const timer = setTimeout(ensureVisible, 100);
    window.addEventListener('resize', ensureVisible);
    return () => { clearTimeout(timer); window.removeEventListener('resize', ensureVisible); };
  }, []);

  // --- DRAG LOGIC ---
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
        const widgetWidth = widgetRef.current?.offsetWidth || 320;
        const widgetHeight = widgetRef.current?.offsetHeight || 200;
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

  // --- CRUD LOGIC ---
  const handleAddNew = () => {
      if (shortcuts.length >= 5) return;
      setEditId(null);
      setFormTitle('');
      setFormUrl('');
      setFormIcon('globe');
      setView('editor');
  };

  const handleEdit = (item: ExtensionShortcut) => {
      setEditId(item.id);
      setFormTitle(item.title);
      setFormUrl(item.url);
      setFormIcon(item.icon);
      setView('editor');
  };

  const handleDelete = (id: string) => {
      const updated = shortcuts.filter(s => s.id !== id);
      onUpdateShortcuts(updated);
  };

  const handleSave = () => {
      if (!formTitle.trim() || !formUrl.trim()) return;
      
      let finalUrl = formUrl.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
          finalUrl = 'https://' + finalUrl;
      }

      if (editId) {
          // Update
          const updated = shortcuts.map(s => s.id === editId ? { ...s, title: formTitle, url: finalUrl, icon: formIcon } : s);
          onUpdateShortcuts(updated);
      } else {
          // Create
          const newShortcut: ExtensionShortcut = {
              id: crypto.randomUUID(),
              title: formTitle,
              url: finalUrl,
              icon: formIcon
          };
          onUpdateShortcuts([...shortcuts, newShortcut]);
      }
      setView('list');
  };

  const openLink = (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      ref={widgetRef}
      style={{ position: 'absolute', left: position.x, top: position.y, zIndex: 45, width: 320 }}
      className="bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden flex flex-col group animate-in fade-in zoom-in-95"
    >
      {/* Header */}
      <div 
        onMouseDown={handleMouseDown}
        className="bg-sky-50 p-2 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-sky-100/50 shrink-0 relative z-20"
      >
        <div className="flex items-center gap-2 text-sky-500 font-bold text-xs uppercase px-2">
            <LinkIcon size={14} />
            <span>Extensões</span>
        </div>
        <div className="flex items-center gap-1">
            <GripHorizontal size={16} className="text-sky-200" />
            <button 
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-full transition-colors"
            >
                <X size={14} />
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-white min-h-[100px]">
         
         {view === 'list' && (
             <div className="flex flex-col gap-2">
                 {shortcuts.map(item => {
                     const IconComp = ICONS[item.icon] || Globe;
                     return (
                         <div key={item.id} className="group/item flex items-center justify-between p-2 rounded-xl border border-stone-100 bg-stone-50 hover:bg-white hover:border-sky-200 hover:shadow-sm transition-all">
                             <div 
                                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                onClick={() => openLink(item.url)}
                             >
                                 <div className="bg-white p-2 rounded-lg text-sky-500 border border-stone-100 group-hover/item:border-sky-100">
                                     <IconComp size={16} />
                                 </div>
                                 <span className="font-bold text-stone-600 text-sm truncate">{item.title}</span>
                             </div>
                             
                             <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                 <button onClick={() => handleEdit(item)} className="p-1.5 text-stone-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg">
                                     <Pencil size={14} />
                                 </button>
                                 <button onClick={() => handleDelete(item.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                     <Trash2 size={14} />
                                 </button>
                             </div>
                         </div>
                     );
                 })}

                 {shortcuts.length < 5 ? (
                     <button 
                        onClick={handleAddNew}
                        className="w-full py-3 mt-2 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center gap-2 text-stone-400 hover:text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-all font-bold text-xs uppercase tracking-wide"
                     >
                         <Plus size={16} /> Adicionar Atalho
                     </button>
                 ) : (
                     <div className="mt-2 flex items-center justify-center gap-2 text-amber-500 text-xs font-bold bg-amber-50 p-2 rounded-lg border border-amber-100">
                         <AlertCircle size={14} />
                         <span>Limite de 5 extensões atingido</span>
                     </div>
                 )}
             </div>
         )}

         {view === 'editor' && (
             <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
                 <div>
                     <label className="text-xs font-bold text-stone-400 uppercase">Título</label>
                     <input 
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg p-2 text-sm outline-none focus:border-sky-300"
                        placeholder="Ex: Google"
                        autoFocus
                     />
                 </div>
                 <div>
                     <label className="text-xs font-bold text-stone-400 uppercase">Link de Destino</label>
                     <input 
                        value={formUrl}
                        onChange={e => setFormUrl(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg p-2 text-sm outline-none focus:border-sky-300"
                        placeholder="google.com"
                     />
                 </div>
                 
                 <div>
                     <label className="text-xs font-bold text-stone-400 uppercase mb-2 block">Ícone</label>
                     <div className="grid grid-cols-5 gap-2">
                         {(Object.keys(ICONS) as IconKey[]).map(iconKey => {
                             const IconComp = ICONS[iconKey];
                             return (
                                 <button
                                    key={iconKey}
                                    onClick={() => setFormIcon(iconKey)}
                                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${formIcon === iconKey ? 'bg-sky-500 text-white shadow-md scale-105' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                                 >
                                     <IconComp size={16} />
                                 </button>
                             )
                         })}
                     </div>
                 </div>

                 <div className="flex gap-2 mt-2 pt-2 border-t border-stone-100">
                     <button onClick={() => setView('list')} className="flex-1 py-2 text-stone-500 hover:bg-stone-100 rounded-lg text-sm font-bold">Cancelar</button>
                     <button onClick={handleSave} className="flex-1 py-2 bg-stone-800 text-white hover:bg-stone-700 rounded-lg text-sm font-bold">Salvar</button>
                 </div>
             </div>
         )}

      </div>
    </div>
  );
};

export default ExtensionWidget;
