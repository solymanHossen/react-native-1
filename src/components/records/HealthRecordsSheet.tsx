import { BottomSheetScrollView, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
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
  const { t } = useTranslation();
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
      setReportStatus(t('healthRecords.reportGenerated'));
      triggerHaptic('notificationSuccess');
    } catch (error) {
      setReportStatus(t('healthRecords.reportFailed', { error: errorMessage(error) }));
    } finally {
      setBusy(null);
    }
  }, [t]);

  const handleExportVault = useCallback(async () => {
    setBusy('export');
    setVaultStatus(null);
    try {
      await exportVaultBackup();
      setVaultStatus(t('healthRecords.backupExported'));
      triggerHaptic('notificationSuccess');
    } catch (error) {
      setVaultStatus(t('healthRecords.exportFailed', { error: errorMessage(error) }));
    } finally {
      setBusy(null);
    }
  }, [t]);

  const handlePickRestoreCandidate = useCallback(async () => {
    setBusy('restore-pick');
    setVaultStatus(null);
    try {
      const candidate = await pickAndValidateRestoreCandidate();
      setRestoreCandidate(candidate);
    } catch (error) {
      if (!(error instanceof VaultRestoreCancelled)) {
        setVaultStatus(t('healthRecords.restoreInvalid', { error: errorMessage(error) }));
      }
    } finally {
      setBusy(null);
    }
  }, [t]);

  const handleConfirmRestore = useCallback(async () => {
    if (!restoreCandidate) return;
    setBusy('restore-apply');
    try {
      await applyVaultRestore(restoreCandidate.path);
      setRestoreCandidate(null);
      setVaultStatus(t('healthRecords.restored'));
      triggerHaptic('notificationSuccess');
    } catch (error) {
      setVaultStatus(t('healthRecords.restoreFailed', { error: errorMessage(error) }));
    } finally {
      setBusy(null);
    }
  }, [restoreCandidate, t]);

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
            {t('healthRecords.title')}
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            {t('healthRecords.subtitle')}
          </Text>
        </View>

        <View className="gap-4 px-6 pb-8">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('healthRecords.patientProfile')}
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('healthRecords.patientProfileDescription')}
          </Text>
          <View className="gap-3">
            <BottomSheetTextInput
              value={profile.name}
              onChangeText={(name) => setProfile((previous) => ({ ...previous, name }))}
              placeholder={t('healthRecords.fullName')}
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-full border px-6 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
            <BottomSheetTextInput
              value={profile.dateOfBirth}
              onChangeText={(dateOfBirth) => setProfile((previous) => ({ ...previous, dateOfBirth }))}
              placeholder={t('healthRecords.dateOfBirth')}
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-full border px-6 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
            <BottomSheetTextInput
              value={profile.bloodType}
              onChangeText={(bloodType) => setProfile((previous) => ({ ...previous, bloodType }))}
              placeholder={t('healthRecords.bloodType')}
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-full border px-6 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
            <BottomSheetTextInput
              value={profile.allergies}
              onChangeText={(allergies) => setProfile((previous) => ({ ...previous, allergies }))}
              placeholder={t('healthRecords.allergies')}
              placeholderTextColor={theme.colors.inkMuted}
              multiline
              className="min-h-hit rounded-3xl border px-6 py-4 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
          </View>
          <LargeTextButton label={t('healthRecords.saveProfile')} variant="secondary" onPress={handleSaveProfile} />
          {profileSaved ? (
            <Text className="text-caption" style={{ color: theme.statusText('taken') }}>
              {t('healthRecords.profileSaved')}
            </Text>
          ) : null}
        </View>

        <View className="gap-4 border-t px-6 pb-8 pt-6" style={{ borderColor: theme.colors.hairline }}>
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('healthRecords.clinicalReport')}
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('healthRecords.clinicalReportDescription')}
          </Text>
          <LargeTextButton
            label={busy === 'report' ? t('healthRecords.generatingReport') : t('healthRecords.generateReport')}
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
            {t('healthRecords.encryptedVault')}
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('healthRecords.encryptedVaultDescription')}
          </Text>
          <LargeTextButton
            label={busy === 'export' ? t('healthRecords.exporting') : t('healthRecords.exportBackup')}
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
                {t('healthRecords.restoreConfirmTitle', { fileName: restoreCandidate.fileName ?? 'backup' })}
              </Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                {t('healthRecords.restoreConfirmBody')}
              </Text>
              <LargeTextButton
                label={busy === 'restore-apply' ? t('healthRecords.restoring') : t('healthRecords.replaceDataNow')}
                loading={busy === 'restore-apply'}
                disabled={busy !== null && busy !== 'restore-apply'}
                onPress={handleConfirmRestore}
              />
              <LargeTextButton label={t('common.cancel')} variant="secondary" disabled={busy !== null} onPress={() => setRestoreCandidate(null)} />
            </View>
          ) : (
            <LargeTextButton
              label={busy === 'restore-pick' ? t('healthRecords.checkingFile') : t('healthRecords.restoreFromBackup')}
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
