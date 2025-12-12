

export type Id = string | number;

export type PastelColor = 'pink' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'rose' | 'sky' | 'teal' | 'indigo' | 'slate';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
}

export interface Task {
  id: Id;
  columnId: Id;
  content: string;
  description?: string;
  color: PastelColor;
  attachments?: Attachment[];
  isChecklist?: boolean;
  checkedItems?: string[];
}

export interface Column {
  id: Id;
  title: string;
  color?: PastelColor | null;
  position: number;
}

export interface Profile {
  id: string;
  name: string;
  pin?: string;
  avatar: string;
  settings?: {
    agenda_pos?: { x: number; y: number };
    agenda_size?: { w: number; h: number };
    agenda_visible?: boolean;
    quote_pos?: { x: number; y: number };
    quote_visible?: boolean;
  };
}

export interface AgendaEvent {
  id: string;
  profile_id: string;
  title: string;
  description?: string;
  start_time: string; // ISO String
  end_time?: string; // ISO String
  category: PastelColor;
  is_completed: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface DayNote {
  id: string;
  profile_id: string;
  date: string; // YYYY-MM-DD
  content: string;
}

export interface DragStartEvent {
  active: { id: Id; data: { current: unknown } };
}

export interface DragOverEvent {
  active: { id: Id; data: { current: unknown } };
  over: { id: Id; data: { current: unknown } } | null;
}

export interface DragEndEvent {
  active: { id: Id; data: { current: unknown } };
  over: { id: Id; data: { current: unknown } } | null;
}