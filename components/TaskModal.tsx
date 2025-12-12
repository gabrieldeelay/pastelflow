
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckSquare, AlignLeft, Link as LinkIcon, Trash2, Send, Check, ChevronDown, Pencil, ExternalLink, Save, Bold, Italic, Underline, Type, Smile, PlusSquare, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { Task, PastelColor, Profile, Attachment } from '../types';
import { COLOR_KEYS, COLOR_HEX } from '../constants';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

interface Props {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTask: Task) => void;
  onDelete: (taskId: string | number) => void;
  profiles: Profile[]; 
  currentProfileId: string;
}

// Darker pastel tones for text
const TEXT_COLORS = [
  { label: 'Padrão', color: '#44403c' }, // Stone 700
  { label: 'Rosa', color: '#db2777' },   // Pink 600
  { label: 'Azul', color: '#2563eb' },   // Blue 600
  { label: 'Verde', color: '#059669' },  // Emerald 600
  { label: 'Roxo', color: '#7c3aed' },   // Violet 600
  { label: 'Laranja', color: '#ea580c' },// Orange 600
];

const COMMON_EMOJIS = ['😀', '😂', '🥰', '😎', '🤔', '😭', '👍', '👎', '🔥', '✨', '✅', '❌', '❤️', '🚀'];

// Generate UUID helper
const getUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- RICH EDITOR COMPONENT ---
interface RichEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  placeholder: string;
  className?: string;
  isTitle?: boolean;
}

const RichEditor: React.FC<RichEditorProps> = ({ initialContent, onChange, placeholder, className, isTitle }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Initialize content once
  useEffect(() => {
    if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialContent;
    }
  }, []); 

  // Watch for external content updates if not focused (simple sync approach)
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current && initialContent !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = initialContent;
    }
  }, [initialContent]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertCheckbox = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const html = `&nbsp;<input type="checkbox" id="${id}" style="margin: 0 4px; vertical-align: middle; accent-color: #57534e; cursor: pointer;" />&nbsp;`;
    document.execCommand('insertHTML', false, html);
    editorRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    document.execCommand('insertText', false, emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="relative group">
      {/* Toolbar */}
      <div 
        className={`
          absolute left-0 -top-10 z-10 flex items-center gap-1 bg-white border border-stone-200 shadow-lg rounded-lg p-1 transition-opacity duration-200
          ${showToolbar ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}
        `}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button onClick={() => execCmd('bold')} className="p-1.5 text-stone-600 hover:bg-stone-100 rounded hover:text-black" title="Negrito"><Bold size={14} /></button>
        <button onClick={() => execCmd('italic')} className="p-1.5 text-stone-600 hover:bg-stone-100 rounded hover:text-black" title="Itálico"><Italic size={14} /></button>
        <button onClick={() => execCmd('underline')} className="p-1.5 text-stone-600 hover:bg-stone-100 rounded hover:text-black" title="Sublinhado"><Underline size={14} /></button>
        
        <div className="w-px h-4 bg-stone-200 mx-1"></div>

        <div className="relative">
          <button onClick={() => { setShowColorPicker(!showColorPicker); setShowEmojiPicker(false); }} className="p-1.5 text-stone-600 hover:bg-stone-100 rounded hover:text-black" title="Cor do Texto">
             <Type size={14} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-stone-200 shadow-xl rounded-lg p-2 grid grid-cols-3 gap-1 w-24">
              {TEXT_COLORS.map((tc) => (
                <button 
                  key={tc.color} 
                  onClick={() => { execCmd('foreColor', tc.color); setShowColorPicker(false); }}
                  className="w-6 h-6 rounded-full border border-stone-100 hover:scale-110 transition-transform"
                  style={{ backgroundColor: tc.color }}
                  title={tc.label}
                />
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowColorPicker(false); }} className="p-1.5 text-stone-600 hover:bg-stone-100 rounded hover:text-black" title="Emojis">
             <Smile size={14} />
          </button>
          {showEmojiPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-stone-200 shadow-xl rounded-lg p-2 grid grid-cols-5 gap-1 w-48 max-h-32 overflow-y-auto custom-scrollbar">
              {COMMON_EMOJIS.map((emoji) => (
                <button 
                  key={emoji} 
                  onClick={() => insertEmoji(emoji)}
                  className="text-lg hover:bg-stone-100 rounded p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-stone-200 mx-1"></div>
        <button onClick={insertCheckbox} className="p-1.5 text-stone-600 hover:bg-stone-100 rounded hover:text-black" title="Inserir Checkbox">
           <PlusSquare size={14} />
        </button>

      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setShowToolbar(true)}
        onBlur={() => {
            setTimeout(() => {
                if (!document.activeElement?.closest('.group')) {
                    setShowToolbar(false);
                    setShowColorPicker(false);
                    setShowEmojiPicker(false);
                }
            }, 200);
        }}
        className={`
          outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300 cursor-text
          ${className}
        `}
        data-placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      />
    </div>
  );
};
// -----------------------------


const TaskModal: React.FC<Props> = ({ 
  task, 
  isOpen, 
  onClose, 
  onUpdate, 
  onDelete,
  profiles,
  currentProfileId
}) => {
  const [content, setContent] = useState(task.content);
  const [description, setDescription] = useState(task.description || '');
  const [color, setColor] = useState<PastelColor>(task.color);
  const [attachments, setAttachments] = useState<Attachment[]>(task.attachments || []);
  
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Attachments
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [showAttachInput, setShowAttachInput] = useState(false);

  const [editingAttId, setEditingAttId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editName, setEditName] = useState('');

  // Sharing
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Delete Confirmation State
  const [confirmDelete, setConfirmDelete] = useState(false);

  // --- REALTIME SYNC FROM PROPS ---
  useEffect(() => {
      if (task.color !== color) {
          setColor(task.color);
      }
      if (JSON.stringify(task.attachments) !== JSON.stringify(attachments)) {
          setAttachments(task.attachments || []);
      }
      if (task.content !== content) {
          setContent(task.content);
      }
      if ((task.description || '') !== description) {
          setDescription(task.description || '');
      }

  }, [task]); 


  // --- AUTOSAVE LOGIC ---
  useEffect(() => {
    if (!isOpen) return;
    
    setSaveStatus('saving');

    const timer = setTimeout(() => {
        const updatedTask = {
            ...task, 
            content,
            description,
            color,
            attachments
        };
        onUpdate(updatedTask);
        setSaveStatus('saved');
    }, 1000); 

    return () => clearTimeout(timer);
  }, [content, description, color, attachments, task.id]);


  useEffect(() => {
    if (isOpen) {
      setContent(task.content);
      setDescription(task.description || '');
      setColor(task.color);
      setAttachments(task.attachments || []);
      setSaveStatus('saved');
    }
  }, [isOpen]); 

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    }
    if (showShareMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShareMenu]);

  const handleManualSave = () => {
    onUpdate({
      ...task,
      content,
      description,
      isChecklist: false, 
      color,
      attachments
    });
    onClose();
  };

  const handleAddAttachment = () => {
    if (!newLinkUrl) return;
    const newAttachment: Attachment = {
      id: Math.random().toString(36).substr(2, 9),
      name: newLinkName || newLinkUrl,
      url: newLinkUrl,
      type: 'link' 
    };
    setAttachments([...attachments, newAttachment]);
    setNewLinkUrl('');
    setNewLinkName('');
    setShowAttachInput(false);
  };

  const startEditingAttachment = (att: Attachment) => {
    setEditingAttId(att.id);
    setEditName(att.name);
    setEditUrl(att.url);
  };

  const saveEditedAttachment = () => {
    if (!editingAttId) return;
    const updated = attachments.map(att => 
        att.id === editingAttId 
            ? { ...att, name: editName || editUrl, url: editUrl }
            : att
    );
    setAttachments(updated);
    setEditingAttId(null);
  };

  const handleShare = async (targetProfile: Profile) => {
    const shareTitle = "Compartilhado";
    if (!isSupabaseConfigured()) {
        try {
            const key = `pastel_data_${targetProfile.id}`;
            const existingData = localStorage.getItem(key);
            let targetData = existingData ? JSON.parse(existingData) : { columns: [], tasks: [] };
            if (!targetData.columns) targetData.columns = [];
            if (!targetData.tasks) targetData.tasks = [];
            
            let sharedCol = targetData.columns.find((c: any) => c.title === shareTitle);
            if (!sharedCol) {
                sharedCol = {
                    id: Math.random().toString(36).substr(2, 9),
                    title: shareTitle,
                    color: 'blue'
                };
                targetData.columns.push(sharedCol);
            }
            const newTask = {
                id: Math.random().toString(36).substr(2, 9),
                columnId: sharedCol.id,
                content: content,
                description: description,
                color: color,
                attachments: attachments
            };
            targetData.tasks.push(newTask);
            localStorage.setItem(key, JSON.stringify(targetData));
            alert(`Nota enviada para ${targetProfile.name}! (Verifique a lista "${shareTitle}")`);
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar localmente. Tente novamente.");
        }
        setShowShareMenu(false);
        return;
    }

    try {
        const { data: cols } = await supabase
            .from('columns')
            .select('*')
            .eq('profile_id', targetProfile.id)
            .eq('title', shareTitle)
            .limit(1);

        let targetColId;

        if (cols && cols.length > 0) {
            targetColId = cols[0].id;
        } else {
            // Create target column if not exists
            const tempColId = getUUID(); // Generate client-side UUID
            const { data: maxPosData } = await supabase
                .from('columns')
                .select('position')
                .eq('profile_id', targetProfile.id)
                .order('position', { ascending: false })
                .limit(1);
            
            const nextPos = (maxPosData?.[0]?.position || 0) + 1;

            const { data: newCol } = await supabase
                .from('columns')
                .insert({
                    id: tempColId, // Explicit UUID
                    profile_id: targetProfile.id,
                    title: shareTitle,
                    position: nextPos,
                    color: 'blue'
                })
                .select()
                .single();
            
            if (newCol) targetColId = newCol.id;
        }

        if (targetColId) {
            await supabase.from('tasks').insert({
                id: getUUID(), // Explicit UUID
                column_id: targetColId,
                content: packTaskForDB({ content, description, color, attachments } as Task), 
                color: color,
                position: 999 
            });
            alert(`Nota enviada para ${targetProfile.name}!`);
        } else {
            alert('Erro ao criar lista de destino.');
        }
    } catch (error) {
        console.error("Erro ao compartilhar", error);
        alert("Erro de conexão ao compartilhar.");
    }
    setShowShareMenu(false);
  };
  
  // Helper to pack for share
  const packTaskForDB = (t: Partial<Task>) => {
      return JSON.stringify({
          title: t.content,
          description: t.description || '',
          attachments: t.attachments || [],
          isChecklist: t.isChecklist || false
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm fade-in p-4 sm:p-6">
      <div 
        className="bg-[#fdfbf7] w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Header Color Strip with Status */}
        <div 
            style={{ backgroundColor: COLOR_HEX[color] }} 
            className="h-4 w-full shrink-0 transition-colors duration-300 flex items-center justify-center relative"
        >
             <div className="absolute top-full mt-1 bg-white/80 backdrop-blur rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-sm border border-stone-100">
                {saveStatus === 'saving' && (
                    <>
                        <Loader2 size={10} className="animate-spin text-stone-400" />
                        <span className="text-stone-400">Salvando...</span>
                    </>
                )}
                {saveStatus === 'saved' && (
                    <>
                        <Cloud size={10} className="text-green-500" />
                        <span className="text-green-600">Salvo na nuvem</span>
                    </>
                )}
                {saveStatus === 'error' && (
                    <>
                        <CloudOff size={10} className="text-red-500" />
                        <span className="text-red-500">Erro ao salvar</span>
                    </>
                )}
             </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 custom-scrollbar pt-8">
          
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            
            {/* Left Column */}
            <div className="flex-1 min-w-0 flex flex-col gap-8">
              
              <div className="flex justify-between items-start gap-4">
                 <div className="flex-1 mt-1">
                   <RichEditor 
                      initialContent={content}
                      onChange={setContent}
                      placeholder="Título da nota..."
                      className="text-2xl sm:text-3xl font-bold text-stone-800 leading-tight min-h-[40px]"
                      isTitle
                   />
                 </div>
                 <button 
                    onClick={handleManualSave} 
                    className="p-2 -mr-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors shrink-0"
                    title="Fechar e Salvar"
                 >
                   <X size={28} />
                 </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3 text-stone-400 text-xs font-bold uppercase tracking-widest">
                  <AlignLeft size={14} />
                  <span>Conteúdo</span>
                </div>
                
                <div className="bg-white border-2 border-stone-100 rounded-xl p-4 shadow-sm focus-within:border-stone-200 transition-colors min-h-[150px]">
                   <RichEditor 
                      initialContent={description}
                      onChange={setDescription}
                      placeholder="Adicione detalhes, observações ou listas aqui..."
                      className="text-stone-600 text-base leading-relaxed min-h-[140px]"
                   />
                </div>
              </div>

              <div className="mt-2">
                 <div className="flex items-center gap-2 mb-3 text-stone-400 text-xs font-bold uppercase tracking-widest">
                   <LinkIcon size={14} />
                   <span>Anexos</span>
                 </div>
                 
                 <div className="flex flex-col gap-3">
                    {attachments.map(att => {
                        const isEditing = editingAttId === att.id;

                        if (isEditing) {
                             return (
                                <div key={att.id} className="bg-white p-3 rounded-xl border-2 border-stone-200 shadow-sm animate-in fade-in zoom-in-95">
                                    <div className="flex flex-col gap-2">
                                        <input 
                                            value={editUrl}
                                            onChange={(e) => setEditUrl(e.target.value)}
                                            placeholder="URL"
                                            className="text-sm bg-stone-50 p-2 rounded border border-stone-100 outline-none focus:border-stone-300"
                                        />
                                        <input 
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            placeholder="Nome"
                                            className="text-sm bg-stone-50 p-2 rounded border border-stone-100 outline-none focus:border-stone-300"
                                        />
                                        <div className="flex justify-end gap-2 mt-1">
                                            <button onClick={() => setEditingAttId(null)} className="p-1 px-3 text-xs text-stone-500 hover:bg-stone-100 rounded">Cancelar</button>
                                            <button onClick={saveEditedAttachment} className="flex items-center gap-1 p-1 px-3 text-xs bg-stone-800 text-white rounded hover:bg-stone-700">
                                                <Save size={12} /> Salvar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                             )
                        }

                        return (
                            <div key={att.id} className="group flex items-center justify-between gap-3 bg-stone-50/50 p-3 rounded-xl border border-stone-100 hover:border-stone-300 hover:bg-white transition-all shadow-sm">
                                <a 
                                    href={att.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                >
                                    <div className="bg-white group-hover:bg-stone-100 p-2 rounded-lg text-stone-400 group-hover:text-stone-600 transition-colors shrink-0">
                                        <ExternalLink size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-stone-700 truncate group-hover:text-blue-600 transition-colors">{att.name}</p>
                                        <p className="text-xs text-stone-400 truncate font-mono">{att.url}</p>
                                    </div>
                                </a>
                                <div className="flex items-center gap-1 pl-2 border-l border-stone-100">
                                    <button onClick={() => startEditingAttachment(att)} className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg">
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {showAttachInput ? (
                        <div className="bg-white p-4 rounded-xl border-2 border-stone-100 shadow-lg animate-in fade-in slide-in-from-top-2 mt-2">
                            <input 
                              placeholder="Cole o link aqui..."
                              className="w-full mb-3 p-3 rounded-lg bg-stone-50 border border-stone-100 text-sm outline-none focus:bg-white focus:border-stone-300 transition-all"
                              value={newLinkUrl}
                              onChange={e => setNewLinkUrl(e.target.value)}
                              autoFocus
                            />
                            <input 
                              placeholder="Nome do arquivo (opcional)"
                              className="w-full mb-4 p-3 rounded-lg bg-stone-50 border border-stone-100 text-sm outline-none focus:bg-white focus:border-stone-300 transition-all"
                              value={newLinkName}
                              onChange={e => setNewLinkName(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowAttachInput(false)} className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100 rounded-lg">Cancelar</button>
                                <button onClick={handleAddAttachment} className="px-4 py-2 text-xs font-bold bg-stone-800 text-white rounded-lg hover:bg-stone-700">Adicionar</button>
                            </div>
                        </div>
                    ) : (
                        <button 
                          onClick={() => setShowAttachInput(true)}
                          className="w-full py-3 mt-1 text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-300 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                          <LinkIcon size={14} /> Adicionar Link ou Arquivo
                        </button>
                    )}
                 </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="w-full lg:w-72 shrink-0 flex flex-col gap-8 pt-6 lg:pt-0 lg:pl-8 border-t lg:border-t-0 lg:border-l border-stone-100">
                
                <div>
                   <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 block">Personalização</label>
                   <div className="grid grid-cols-6 lg:grid-cols-3 gap-3">
                      {COLOR_KEYS.map(k => (
                          <button
                            key={k}
                            onClick={() => setColor(k)}
                            className={`
                                aspect-square rounded-full border-2 transition-all duration-300 relative
                                ${color === k ? 'border-stone-400 scale-110 shadow-md' : 'border-transparent hover:scale-105'}
                            `}
                            style={{ backgroundColor: COLOR_HEX[k] }}
                          >
                             {color === k && <div className="absolute inset-0 flex items-center justify-center text-stone-600/50"><Check size={14} /></div>}
                          </button>
                      ))}
                   </div>
                </div>

                <div className="flex flex-col gap-3">
                   <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1 block">Ações</label>
                   
                   <div className="relative" ref={shareMenuRef}>
                        <button 
                            onClick={() => setShowShareMenu(!showShareMenu)}
                            className={`
                                w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 
                                text-stone-600 text-sm font-bold hover:border-stone-300 hover:bg-white transition-all
                                ${showShareMenu ? 'bg-stone-50 border-stone-300' : 'bg-stone-50/50'}
                            `}
                        >
                            <span className="flex items-center gap-2"><Send size={16} /> Compartilhar</span>
                            <ChevronDown size={14} className={`transition-transform ${showShareMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showShareMenu && (
                            <div className="absolute left-0 bottom-full mb-2 w-full bg-white rounded-xl shadow-xl border border-stone-100 p-2 z-[60] animate-in fade-in zoom-in-95 origin-bottom">
                                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider px-3 py-2">Enviar para:</p>
                                <div className="max-h-48 overflow-y-auto">
                                    {profiles.filter(p => p.id !== currentProfileId).map(profile => (
                                        <button
                                            key={profile.id}
                                            onClick={() => handleShare(profile)}
                                            className="w-full text-left flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg transition-colors group"
                                        >
                                            <img src={profile.avatar} className="w-8 h-8 rounded-full border border-stone-100" />
                                            <span className="text-sm font-bold text-stone-600 group-hover:text-stone-800 truncate">{profile.name}</span>
                                        </button>
                                    ))}
                                    {profiles.length <= 1 && <p className="text-sm text-stone-400 p-3 italic text-center">Nenhum outro perfil disponível.</p>}
                                </div>
                            </div>
                        )}
                   </div>

                   {/* Delete Button with 2-step confirmation */}
                   {!confirmDelete ? (
                       <button 
                         onClick={() => setConfirmDelete(true)}
                         className="w-full flex items-center gap-2 p-3 rounded-xl text-red-500 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all text-sm font-bold"
                       >
                           <Trash2 size={16} /> Excluir Nota
                       </button>
                   ) : (
                       <div className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                           <button 
                             onClick={() => setConfirmDelete(false)}
                             className="flex-1 p-3 rounded-xl text-stone-500 bg-stone-100 hover:bg-stone-200 text-sm font-bold"
                           >
                             Cancelar
                           </button>
                           <button 
                             onClick={() => onDelete(task.id)}
                             className="flex-1 p-3 rounded-xl text-white bg-red-500 hover:bg-red-600 text-sm font-bold"
                           >
                             Confirmar?
                           </button>
                       </div>
                   )}
                </div>
            </div>

          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-100 flex justify-end bg-stone-50/80 backdrop-blur-sm shrink-0">
           <button 
             onClick={handleManualSave}
             className="bg-stone-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-700 active:scale-95 transition-all shadow-lg shadow-stone-200"
           >
             {saveStatus === 'saving' ? 'Salvando...' : 'Fechar & Salvar'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
