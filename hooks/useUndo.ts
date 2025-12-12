import React, { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Task, AgendaEvent } from '../types';

type ActionType = 
    | { type: 'TASK_CREATE', data: Task }
    | { type: 'TASK_DELETE', data: Task }
    | { type: 'TASK_UPDATE', prev: Task, current: Task }
    | { type: 'EVENT_CREATE', data: AgendaEvent }
    | { type: 'EVENT_DELETE', data: AgendaEvent }
    | { type: 'EVENT_UPDATE', prev: AgendaEvent, current: AgendaEvent };

export const useUndo = (
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
    setAgendaEvents: React.Dispatch<React.SetStateAction<AgendaEvent[]>>
) => {
    const [history, setHistory] = useState<ActionType[]>([]);

    const addToHistory = useCallback((action: ActionType) => {
        setHistory(prev => [...prev, action]);
    }, []);

    const undo = useCallback(async () => {
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const newHistory = [...prev];
            const action = newHistory.pop();
            
            if (!action) return prev;

            // Execute Reversal
            const reverse = async () => {
                const isOnline = isSupabaseConfigured();

                switch (action.type) {
                    case 'TASK_CREATE':
                        // Reverse: Delete
                        setTasks(curr => curr.filter(t => t.id !== action.data.id));
                        if(isOnline) await supabase.from('tasks').delete().eq('id', action.data.id);
                        break;
                    case 'TASK_DELETE':
                        // Reverse: Create
                        setTasks(curr => [...curr, action.data]);
                        if(isOnline) {
                             const pack = {
                                id: action.data.id,
                                column_id: action.data.columnId,
                                content: JSON.stringify({
                                    title: action.data.content,
                                    description: action.data.description,
                                    attachments: action.data.attachments,
                                    isChecklist: action.data.isChecklist
                                }),
                                color: action.data.color,
                                position: 999 
                             };
                             await supabase.from('tasks').insert(pack);
                        }
                        break;
                    case 'TASK_UPDATE':
                        // Reverse: Revert to prev
                        setTasks(curr => curr.map(t => t.id === action.prev.id ? action.prev : t));
                        if(isOnline) {
                             const pack = {
                                column_id: action.prev.columnId,
                                content: JSON.stringify({
                                    title: action.prev.content,
                                    description: action.prev.description,
                                    attachments: action.prev.attachments,
                                    isChecklist: action.prev.isChecklist
                                }),
                                color: action.prev.color
                             };
                             await supabase.from('tasks').update(pack).eq('id', action.prev.id);
                        }
                        break;
                    case 'EVENT_CREATE':
                        setAgendaEvents(curr => curr.filter(e => e.id !== action.data.id));
                        if(isOnline) await supabase.from('agenda_events').delete().eq('id', action.data.id);
                        break;
                    case 'EVENT_DELETE':
                        setAgendaEvents(curr => [...curr, action.data]);
                        if(isOnline) await supabase.from('agenda_events').insert(action.data);
                        break;
                    case 'EVENT_UPDATE':
                        setAgendaEvents(curr => curr.map(e => e.id === action.prev.id ? action.prev : e));
                        if(isOnline) await supabase.from('agenda_events').update({
                             title: action.prev.title,
                             description: action.prev.description,
                             start_time: action.prev.start_time,
                             category: action.prev.category,
                             is_completed: action.prev.is_completed,
                             priority: action.prev.priority || null
                        }).eq('id', action.prev.id);
                        break;
                }
            };
            reverse();
            return newHistory;
        });
    }, [setTasks, setAgendaEvents]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo]);

    return { addToHistory };
};