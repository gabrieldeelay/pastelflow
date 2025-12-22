
import React, { useState, useEffect, useRef } from 'react';
import { 
  Link as LinkIcon, X, GripHorizontal, Plus, Globe, Search, Mail, Code, 
  Video, Music, Image, ShoppingCart, MessageCircle, Zap, Trash2, Pencil, ExternalLink, AlertCircle, GripVertical
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

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group/item flex items-center justify-between p-2 rounded-xl border border-stone-100 bg-stone-50 hover:bg-white hover:border-sky-200 hover:shadow-sm transition-all mb-2 ${isDragging && !isOverlay ? 'border-dashed border-stone-300 bg-stone-100/50' : ''} ${isOverlay ? 'shadow-2xl ring-2 ring-sky-300 bg-white !opacity-100 scale-[1.05] border-sky-200 z-[100]' : ''}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        style={{ touchAction: 'none' }}
        className="cursor-grab active:cursor-grabbing p-1.5 text-stone-300 hover:text-sky-400 transition-colors"
      >
        <GripVertical size={14} />
      </div>
      
      <div 
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => !isOverlay && onClick(item.url)}
      >
        <div className="bg-white p-2 rounded-lg text-sky-500 border border-stone-100 group-hover/item:border-sky-100">
          <IconComp size={16} />
        </div>
        <span className="font-bold text-stone-600 text-sm truncate">{item.title}</span>
      </div>
      
      {!isOverlay && (
        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
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

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 4, // More responsive
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // --- WIDGET DRAG LOGIC ---
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
          const updated = shortcuts.map(s => s.id === editId ? { ...s, title: formTitle, url: finalUrl, icon: formIcon } : s);
          onUpdateShortcuts(updated);
      } else {
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
      <div className="p-4 bg-white min-h-[100px]">
         
         {view === 'list' && (
             <div className="flex flex-col">
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

                 {shortcuts.length < 5 ? (
                     <button 
                        onClick={handleAddNew}
                        className="w-full py-3 mt-1 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center gap-2 text-stone-400 hover:text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-all font-bold text-xs uppercase tracking-wide"
                     >
                         <Plus size={16} /> Adicionar Atalho
                     </button>
                 ) : (
                     <div className="mt-1 flex items-center justify-center gap-2 text-amber-500 text-xs font-bold bg-amber-50 p-2 rounded-lg border border-amber-100">
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
