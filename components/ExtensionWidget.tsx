
import React, { useState, useEffect, useRef } from 'react';
import { 
  Link as LinkIcon, X, GripHorizontal, Plus, Globe, Search, Mail, Code, 
  Video, Music, Image, ShoppingCart, MessageCircle, Zap, Trash2, Pencil, ExternalLink, AlertCircle, GripVertical, Check
} from 'lucide-react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExtensionShortcut, PastelColor } from '../types';
import { COLOR_KEYS, COLOR_HEX } from '../constants';

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

// --- Sortable Item Component ---
interface SortableItemProps {
  item: ExtensionShortcut;
  onEdit: (item: ExtensionShortcut) => void;
  onDelete: (id: string) => void;
  onClick: (url: string) => void;
  isOverlay?: boolean;
}

const SortableShortcutItem: React.FC<SortableItemProps> = ({ item, onEdit, onDelete, onClick, isOverlay }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 60 : 'auto',
    opacity: isDragging && !isOverlay ? 0.3 : 1,
  };

  const IconComp = ICONS[item.icon] || Globe;
  const itemColor = item.color ? COLOR_HEX[item.color] : '#f1f5f9'; // fallback to slate-100 style

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group/item flex items-center justify-between p-2 rounded-xl border border-stone-100 bg-stone-50 hover:bg-white transition-all mb-2 ${isDragging && !isOverlay ? 'border-dashed border-stone-300 bg-stone-100/50' : ''} ${isOverlay ? 'shadow-2xl ring-2 ring-sky-300 bg-white !opacity-100 scale-[1.05] border-sky-200 z-[100]' : ''}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        style={{ touchAction: 'none' }}
        className="cursor-grab active:cursor-grabbing p-1.5 text-stone-300 hover:text-stone-500 transition-colors"
      >
        <GripVertical size={14} />
      </div>
      
      <div 
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => !isOverlay && onClick(item.url)}
      >
        <div 
            className="p-2 rounded-lg border border-stone-100 transition-colors"
            style={{ backgroundColor: itemColor, color: item.color ? 'inherit' : '#0ea5e9' }}
        >
          <IconComp size={16} />
        </div>
        <span className="font-bold text-stone-600 text-sm truncate">{item.title}</span>
      </div>
      
      {!isOverlay && (
        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity pr-1">
            <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1.5 text-stone-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg">
                <Pencil size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 size={14} />
            </button>
        </div>
      )}
    </div>
  );
};

const ExtensionWidget: React.FC<Props> = ({ shortcuts, onUpdateShortcuts, onRemove, initialPosition, onLayoutChange }) => {
  const [position, setPosition] = useState(initialPosition || { x: 100, y: 100 });
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Editor State
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formIcon, setFormIcon] = useState<IconKey>('globe');
  const [formColor, setFormColor] = useState<PastelColor | undefined>(undefined);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 4, 
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingWidget(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingWidget) {
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
      if (isDraggingWidget) {
        setIsDraggingWidget(false);
        onLayoutChange(position.x, position.y);
      }
    };
    if (isDraggingWidget) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingWidget, position, onLayoutChange]);

  const handleAddNew = () => {
      setEditId(null);
      setFormTitle('');
      setFormUrl('');
      setFormIcon('globe');
      setFormColor(undefined);
      setView('editor');
  };

  const handleEdit = (item: ExtensionShortcut) => {
      setEditId(item.id);
      setFormTitle(item.title);
      setFormUrl(item.url);
      setFormIcon(item.icon);
      setFormColor(item.color);
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
          const updated = shortcuts.map(s => s.id === editId ? { ...s, title: formTitle, url: finalUrl, icon: formIcon, color: formColor } : s);
          onUpdateShortcuts(updated);
      } else {
          const newShortcut: ExtensionShortcut = {
              id: crypto.randomUUID(),
              title: formTitle,
              url: finalUrl,
              icon: formIcon,
              color: formColor
          };
          onUpdateShortcuts([...shortcuts, newShortcut]);
      }
      setView('list');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEndShortcuts = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = shortcuts.findIndex((s) => s.id === active.id);
      const newIndex = shortcuts.findIndex((s) => s.id === over.id);
      const newShortcuts = arrayMove(shortcuts, oldIndex, newIndex);
      onUpdateShortcuts(newShortcuts);
    }
    setActiveId(null);
  };

  const openLink = (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
  };

  const activeShortcut = activeId ? shortcuts.find(s => s.id === activeId) : null;

  return (
    <div 
      ref={widgetRef}
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 45, width: 320 }}
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
      <div className="p-4 bg-white min-h-[140px] flex flex-col">
         
         {view === 'list' && (
             <div className="flex flex-col h-full">
                 <div className="max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                    <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEndShortcuts}
                    >
                    <SortableContext 
                        items={shortcuts.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col">
                            {shortcuts.map(item => (
                            <SortableShortcutItem 
                                key={item.id} 
                                item={item} 
                                onEdit={handleEdit} 
                                onDelete={handleDelete} 
                                onClick={openLink}
                            />
                            ))}
                        </div>
                    </SortableContext>
                    
                    <DragOverlay 
                            dropAnimation={{
                                sideEffects: defaultDropAnimationSideEffects({
                                    styles: { active: { opacity: '0.4' } }
                                })
                            }}
                            className="pointer-events-none"
                    >
                        {activeShortcut ? (
                            <SortableShortcutItem 
                            item={activeShortcut}
                            onEdit={() => {}}
                            onDelete={() => {}}
                            onClick={() => {}}
                            isOverlay
                            />
                        ) : null}
                    </DragOverlay>
                    </DndContext>
                 </div>

                 <button 
                    onClick={handleAddNew}
                    className="w-full py-3 mt-2 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center gap-2 text-stone-400 hover:text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-all font-bold text-xs uppercase tracking-wide shrink-0"
                 >
                     <Plus size={16} /> Adicionar Atalho
                 </button>
             </div>
         )}

         {view === 'editor' && (
             <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                 <div>
                     <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Título</label>
                     <input 
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg p-2 text-sm outline-none focus:border-sky-300"
                        placeholder="Ex: Google"
                        autoFocus
                     />
                 </div>
                 <div>
                     <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Link de Destino</label>
                     <input 
                        value={formUrl}
                        onChange={e => setFormUrl(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg p-2 text-sm outline-none focus:border-sky-300"
                        placeholder="google.com"
                     />
                 </div>
                 
                 <div>
                     <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Ícone</label>
                     <div className="grid grid-cols-5 gap-2">
                         {(Object.keys(ICONS) as IconKey[]).map(iconKey => {
                             const IconComp = ICONS[iconKey];
                             return (
                                 <button
                                    key={iconKey}
                                    onClick={() => setFormIcon(iconKey)}
                                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${formIcon === iconKey ? 'bg-sky-500 text-white shadow-md scale-105 border-sky-600' : 'bg-stone-50 text-stone-400 border border-stone-100 hover:bg-stone-100'}`}
                                 >
                                     <IconComp size={16} />
                                 </button>
                             )
                         })}
                     </div>
                 </div>

                 <div>
                     <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Cor do Atalho</label>
                     <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setFormColor(undefined)}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${formColor === undefined ? 'border-sky-500 ring-2 ring-sky-200 scale-110' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'}`}
                        >
                            <div className="w-3 h-0.5 bg-stone-400 -rotate-45" />
                        </button>
                        {COLOR_KEYS.map(key => (
                            <button
                                key={key}
                                onClick={() => setFormColor(key)}
                                className={`w-7 h-7 rounded-full border transition-all relative ${formColor === key ? 'border-stone-600 ring-2 ring-stone-200 scale-110' : 'border-stone-100'}`}
                                style={{ backgroundColor: COLOR_HEX[key] }}
                            >
                                {formColor === key && <Check size={12} className="absolute inset-0 m-auto text-stone-600" />}
                            </button>
                        ))}
                     </div>
                 </div>

                 <div className="flex gap-2 mt-2 pt-2 border-t border-stone-100 sticky bottom-0 bg-white">
                     <button onClick={() => setView('list')} className="flex-1 py-2 text-stone-500 hover:bg-stone-100 rounded-lg text-sm font-bold">Cancelar</button>
                     <button onClick={handleSave} className="flex-1 py-2 bg-stone-800 text-white hover:bg-stone-700 rounded-lg text-sm font-bold shadow-md active:scale-95">Salvar</button>
                 </div>
             </div>
         )}

      </div>
    </div>
  );
};

export default ExtensionWidget;
