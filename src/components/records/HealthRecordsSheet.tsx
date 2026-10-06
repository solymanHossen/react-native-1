import { BottomSheetScrollView, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { getPatientProfile, setPatientProfile, type PatientProfile } from '../../profile/patientProfile';
import { generateClinicalReportPdf, shareClinicalReportPdf } from '../../reports/pdfService';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';
import {
  applyVaultRestore,
  exportVaultBackup,
  pickAndValidateRestoreCandidate,
  VaultRestoreCancelled,
  type RestoreCandidate,
} from '../../vault/vaultBackup';
import { LargeTextButton } from '../ui';

export interface HealthRecordsSheetRef {
  present: () => void;
}

type Busy = null | 'report' | 'export' | 'restore-pick' | 'restore-apply';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/**
 * One sheet for the three offline-only record flows that don't belong on any
 * existing tab: editing the demographics the PDF/SOS message read from,
 * generating and sharing the clinical PDF, and exporting/restoring the
 * encrypted vault file. Grouped together because they're all "do this
 * occasionally, not every day" actions — a 7th bottom tab for them would
 * crowd the tab bar for something used far less often than Home or Alarms.
 */
export const HealthRecordsSheet = forwardRef<HealthRecordsSheetRef, Record<string, unknown>>(function HealthRecordsSheetImpl(_props, ref) {
  const theme = useTheme();
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['90%'], []);

  const [profile, setProfile] = useState<PatientProfile>(() => getPatientProfile());
  const [profileSaved, setProfileSaved] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [vaultStatus, setVaultStatus] = useState<string | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<RestoreCandidate | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setProfile(getPatientProfile());
        setProfileSaved(false);
        setReportStatus(null);
        setVaultStatus(null);
        setRestoreCandidate(null);
        modalRef.current?.present();
      },
    }),
    [],
  );

  const handleSaveProfile = useCallback(() => {
    setPatientProfile(profile);
    setProfileSaved(true);
    triggerHaptic('selection');
  }, [profile]);

  const handleGenerateReport = useCallback(async () => {
    setBusy('report');
    setReportStatus(null);
    try {
      const filePath = await generateClinicalReportPdf();
      await shareClinicalReportPdf(filePath);
      setReportStatus('Report generated.');
      triggerHaptic('notificationSuccess');
    } catch (error) {
      setReportStatus(`Could not generate the report: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const handleExportVault = useCallback(async () => {
    setBusy('export');
    setVaultStatus(null);
    try {
      await exportVaultBackup();
      setVaultStatus('Encrypted backup exported.');
      triggerHaptic('notificationSuccess');
    } catch (error) {
      setVaultStatus(`Could not export the backup: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const handlePickRestoreCandidate = useCallback(async () => {
    setBusy('restore-pick');
    setVaultStatus(null);
    try {
      const candidate = await pickAndValidateRestoreCandidate();
      setRestoreCandidate(candidate);
    } catch (error) {
      if (!(error instanceof VaultRestoreCancelled)) {
        setVaultStatus(`That file isn't a valid Medius Health backup for this device: ${errorMessage(error)}`);
      }
    } finally {
      setBusy(null);
    }
  }, []);

  const handleConfirmRestore = useCallback(async () => {
    if (!restoreCandidate) return;
    setBusy('restore-apply');
    try {
      await applyVaultRestore(restoreCandidate.path);
      setRestoreCandidate(null);
      setVaultStatus('Restored. Close and reopen the app for every screen to pick up the restored data.');
      triggerHaptic('notificationSuccess');
    } catch (error) {
      setVaultStatus(`Restore failed: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  }, [restoreCandidate]);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-1 px-6 pb-4">
          <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
            Health Records &amp; Backup
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            Everything here runs on-device — nothing is uploaded anywhere.
          </Text>
        </View>

        <View className="gap-4 px-6 pb-8">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Patient Profile
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            Used on the clinical PDF report and in the emergency SOS message sent to your caregiver.
          </Text>
          <View className="gap-3">
            <BottomSheetTextInput
              value={profile.name}
              onChangeText={(name) => setProfile((previous) => ({ ...previous, name }))}
              placeholder="Full name"
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-full border px-6 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
            <BottomSheetTextInput
              value={profile.dateOfBirth}
              onChangeText={(dateOfBirth) => setProfile((previous) => ({ ...previous, dateOfBirth }))}
              placeholder="Date of birth (e.g. 1958-04-12)"
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-full border px-6 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
            <BottomSheetTextInput
              value={profile.bloodType}
              onChangeText={(bloodType) => setProfile((previous) => ({ ...previous, bloodType }))}
              placeholder="Blood type (e.g. O+)"
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-full border px-6 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
            <BottomSheetTextInput
              value={profile.allergies}
              onChangeText={(allergies) => setProfile((previous) => ({ ...previous, allergies }))}
              placeholder="Known allergies"
              placeholderTextColor={theme.colors.inkMuted}
              multiline
              className="min-h-hit rounded-3xl border px-6 py-4 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
          </View>
          <LargeTextButton label="Save Profile" variant="secondary" onPress={handleSaveProfile} />
          {profileSaved ? (
            <Text className="text-caption" style={{ color: theme.statusText('taken') }}>
              Profile saved.
            </Text>
          ) : null}
        </View>

        <View className="gap-4 border-t px-6 pb-8 pt-6" style={{ borderColor: theme.colors.hairline }}>
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Clinical Report
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            A 30-day PDF covering medications, adherence, blood pressure &amp; glucose logs, and adverse reactions — ready to print, email, or share over WhatsApp.
          </Text>
          <LargeTextButton
            label={busy === 'report' ? 'Generating…' : 'Generate & Share PDF Report'}
            loading={busy === 'report'}
            disabled={busy !== null && busy !== 'report'}
            onPress={handleGenerateReport}
          />
          {reportStatus ? (
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {reportStatus}
            </Text>
          ) : null}
        </View>

        <View className="gap-4 border-t px-6 pt-6" style={{ borderColor: theme.colors.hairline }}>
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Encrypted Vault
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            Export stays encrypted with this device's own key the entire time — there's no point where it's written as plaintext. A restored backup only works on the device it came from.
          </Text>
          <LargeTextButton
            label={busy === 'export' ? 'Exporting…' : 'Export Encrypted Backup'}
            variant="secondary"
            loading={busy === 'export'}
            disabled={busy !== null && busy !== 'export'}
            onPress={handleExportVault}
          />

          {restoreCandidate ? (
            <View
              className="gap-3 rounded-3xl border p-5"
              style={{ backgroundColor: theme.statusTint('missed'), borderColor: theme.colors.hairline }}
            >
              <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '700' }}>
                Restore "{restoreCandidate.fileName ?? 'backup'}"?
              </Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                This replaces every medication, schedule, vitals reading, and symptom log currently on this device with what's in this backup. Your current data is saved alongside it first, but this cannot be undone from within the app.
              </Text>
              <LargeTextButton
                label={busy === 'restore-apply' ? 'Restoring…' : 'Replace Current Data Now'}
                loading={busy === 'restore-apply'}
                disabled={busy !== null && busy !== 'restore-apply'}
                onPress={handleConfirmRestore}
              />
              <LargeTextButton label="Cancel" variant="secondary" disabled={busy !== null} onPress={() => setRestoreCandidate(null)} />
            </View>
          ) : (
            <LargeTextButton
              label={busy === 'restore-pick' ? 'Checking file…' : 'Restore from Backup'}
              variant="secondary"
              loading={busy === 'restore-pick'}
              disabled={busy !== null && busy !== 'restore-pick'}
              onPress={handlePickRestoreCandidate}
            />
          )}

          {vaultStatus ? (
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {vaultStatus}
            </Text>
          ) : null}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
