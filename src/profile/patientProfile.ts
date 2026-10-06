import { storage } from '../lib/storage';

const PATIENT_PROFILE_KEY = 'patient-profile';

export interface PatientProfile {
  name: string;
  dateOfBirth: string;
  bloodType: string;
  allergies: string;
}

const EMPTY_PROFILE: PatientProfile = { name: '', dateOfBirth: '', bloodType: '', allergies: '' };

/**
 * Single MMKV record, same convention as the caregiver phone number
 * (`alarms/caregiverEscalation.ts`) — this is device-local settings data, not
 * a clinical record with its own history, so it doesn't warrant a SQLite
 * table of its own.
 */
export function getPatientProfile(): PatientProfile {
  const raw = storage.getString(PATIENT_PROFILE_KEY);
  if (!raw) return EMPTY_PROFILE;
  try {
    const parsed = JSON.parse(raw) as Partial<PatientProfile>;
    return { ...EMPTY_PROFILE, ...parsed };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function setPatientProfile(profile: PatientProfile): void {
  storage.set(PATIENT_PROFILE_KEY, JSON.stringify(profile));
}
