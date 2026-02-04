/**
 * Tipi TypeScript per lo schema database Supabase
 * Da Filo a Trama - Piattaforma Eventi Scout
 */

// ============================================
// PROFILES
// ============================================
export interface Profile {
  id: string;
  clerk_id: string;
  email: string;
  name: string | null;
  surname: string | null;
  scout_group: string | null;
  role: 'user' | 'staff' | 'admin';
  preferences: string[];
  avatar_config: AvatarConfig;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarConfig {
  skinTone?: string;
  hairStyle?: string;
  hairColor?: string;
  eyeColor?: string;
  accessories?: string[];
  clothing?: string;
  background?: string;
}

export interface ProfileUpdate {
  name?: string;
  surname?: string;
  scout_group?: string;
  preferences?: string[];
  avatar_config?: AvatarConfig;
  onboarding_completed?: boolean;
}

// ============================================
// EVENTS
// ============================================
export type EventCategory =
  | 'workshop'
  | 'conferenza'
  | 'laboratorio'
  | 'gioco'
  | 'spiritualita'
  | 'servizio'
  | 'altro';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  tags: string[];
  location: string | null;
  poi_id: string | null;
  start_time: string;
  end_time: string;
  max_posti: number;
  speaker_name: string | null;
  speaker_bio: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventWithEnrollment extends Event {
  enrollment_count: number;
  is_enrolled: boolean;
  enrollment_status: EnrollmentStatus | null;
}

// ============================================
// ENROLLMENTS
// ============================================
export type EnrollmentStatus = 'confirmed' | 'waitlist' | 'cancelled';

export interface Enrollment {
  id: string;
  user_id: string;
  event_id: string;
  status: EnrollmentStatus;
  waitlist_position: number | null;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentResult {
  success: boolean;
  status: EnrollmentStatus;
  waitlist_position?: number;
  message?: string;
}

// ============================================
// POI (Points of Interest)
// ============================================
export type PoiCategory =
  | 'evento'
  | 'servizi'
  | 'ristoro'
  | 'emergenza'
  | 'info'
  | 'parcheggio';

export interface Poi {
  id: string;
  name: string;
  description: string | null;
  category: PoiCategory;
  latitude: number;
  longitude: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

// ============================================
// ASSETS
// ============================================
export type AssetType = 'pdf' | 'image' | 'video' | 'audio' | 'document';
export type AssetVisibility = 'public' | 'registered' | 'staff';

export interface Asset {
  id: string;
  event_id: string | null;
  name: string;
  file_type: AssetType;
  file_url: string;
  file_size: number | null;
  visibilita: AssetVisibility;
  download_count: number;
  created_at: string;
}

// ============================================
// PREFERENCE TAGS (costanti)
// ============================================
export const PREFERENCE_TAGS = [
  'avventura',
  'natura',
  'creativita',
  'spiritualita',
  'servizio',
  'leadership',
  'musica',
  'sport',
  'tecnologia',
  'sostenibilita',
  'internazionale',
  'tradizione',
] as const;

export type PreferenceTag = typeof PREFERENCE_TAGS[number];

// ============================================
// API Response types
// ============================================
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
