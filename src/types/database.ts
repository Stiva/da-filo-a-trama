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
  first_name: string | null;
  scout_group: string | null;
  role: 'user' | 'staff' | 'admin';
  preferences: string[];
  avatar_config: AvatarConfig;
  onboarding_completed: boolean;
  avatar_completed: boolean;
  preferences_set: boolean;
  profile_setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface NeckerchiefConfig {
  enabled: boolean;
  colorCount: 1 | 2 | 3;
  color1: string;      // Colore principale
  color2?: string;     // Secondo colore (bordo)
  color3?: string;     // Terzo colore (punta/dettaglio)
}

export interface AvatarConfig {
  gender: 'male' | 'female';
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  neckerchief: NeckerchiefConfig;
  clothing: string;
  background: string;
  accessories?: string[];
}

export interface ProfileUpdate {
  name?: string;
  surname?: string;
  first_name?: string;
  scout_group?: string;
  preferences?: string[];
  avatar_config?: Partial<AvatarConfig>;
  onboarding_completed?: boolean;
  avatar_completed?: boolean;
  preferences_set?: boolean;
}

// Default avatar configuration
export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  gender: 'male',
  skinTone: '#DEB887',
  hairStyle: 'short',
  hairColor: '#4A3728',
  eyeColor: '#5D4E37',
  neckerchief: {
    enabled: true,
    colorCount: 2,
    color1: '#1E6091',
    color2: '#FFDE00',
  },
  clothing: '#2D5016',
  background: '#E8F4E8',
};

// ============================================
// EVENTS
// ============================================
// Must match DB CHECK constraint in 003_events.sql
export type EventCategory =
  | 'workshop'
  | 'conferenza'
  | 'laboratorio'
  | 'gioco'
  | 'spiritualita'
  | 'servizio'
  | 'natura'
  | 'arte'
  | 'musica'
  | 'altro';

// Event visibility - public = everyone, registered = only authenticated users
export type EventVisibility = 'public' | 'registered';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  tags: string[];
  location_poi_id: string;
  poi: Poi;
  start_time: string;
  end_time: string;
  max_posti: number;
  speaker_name: string | null;
  speaker_bio: string | null;
  is_published: boolean;
  is_featured: boolean;
  visibility: EventVisibility;
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
// Must match DB CHECK constraint in 005_poi.sql
export type PoiCategory =
  | 'stage'      // Palco/area eventi
  | 'food'       // Punto ristoro
  | 'toilet'     // Servizi igienici
  | 'medical'    // Punto medico
  | 'info'       // Info point
  | 'camping'    // Area campeggio
  | 'parking'    // Parcheggio
  | 'worship'    // Area spiritualita
  | 'activity'   // Area attivita
  | 'entrance'   // Ingresso
  | 'other';     // Altro

// Raw POI from database
export interface PoiRaw {
  id: string;
  nome: string;
  descrizione: string | null;
  tipo: PoiCategory;
  coordinate: unknown;  // PostGIS geography
  icon_url: string | null;
  is_active: boolean;
  floor_level: number;
  opening_hours: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

// POI with extracted lat/lng for frontend use
export interface Poi {
  id: string;
  nome: string;
  descrizione: string | null;
  tipo: PoiCategory;
  latitude: number;
  longitude: number;
  icon_url: string | null;
  is_active: boolean;
  created_at: string;
}

// POI type labels in Italian for UI display
export const POI_TYPE_LABELS: Record<PoiCategory, string> = {
  stage: 'Palco',
  food: 'Ristoro',
  toilet: 'Servizi Igienici',
  medical: 'Punto Medico',
  info: 'Info Point',
  camping: 'Campeggio',
  parking: 'Parcheggio',
  worship: 'Spiritualità',
  activity: 'Attività',
  entrance: 'Ingresso',
  other: 'Altro',
};

// ============================================
// ASSETS
// ============================================
export type AssetType = 'pdf' | 'image' | 'video' | 'audio' | 'document';
export type AssetVisibility = 'public' | 'registered' | 'staff';

export interface Asset {
  id: string;
  event_id: string | null;
  poi_id: string | null;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  tipo: AssetType;
  visibilita: AssetVisibility;
  title: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  uploaded_by: string | null;
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
// DASHBOARD CONTENT
// ============================================
export type UserState = 'no_profile' | 'new_user' | 'onboarding_done' | 'profile_complete' | 'enrolled' | 'all';

export interface DashboardContentStep {
  icon: string;
  text: string;
}

export interface DashboardContentData {
  steps?: DashboardContentStep[];
  text?: string;
  highlight?: boolean;
}

export interface DashboardContent {
  id: string;
  key: string;
  title: string | null;
  content: DashboardContentData;
  target_state: UserState;
  display_order: number;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// API Response types
// ============================================
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
