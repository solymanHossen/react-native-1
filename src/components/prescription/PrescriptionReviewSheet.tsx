import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  normalizeBengaliDigits,
  parseDoseSchedule,
  parseDoseQuantity,
  parseMealRelation,
  parseDuration,
  summarizeDosage,
  type ConfidenceTier,
  type ParsedPrescriptionItem,
} from '../../ocr';
import { useTranslation } from '../../i18n';
import type { StatusKey } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { LargeTextButton } from '../ui';

export interface PrescriptionReviewSheetRef {
  present: (items: ParsedPrescriptionItem[]) => void;
  dismiss: () => void;
}

export interface PrescriptionReviewSheetProps {
  /** Called with the final, human-reviewed list once the caregiver taps "Confirm". Removed items are not included. */
  onConfirm: (items: ParsedPrescriptionItem[]) => void;
}

interface ReviewableItem {
  /** Stable per-card key — index-based IDs would shift identity when a card above it is removed, breaking input focus mid-edit. */
  id: string;
  drugName: string;
  summary: string;
  confidence: number;
  tier: ConfidenceTier;
  autoMapped: boolean;
  suggestedGeneric: string | null;
  original: ParsedPrescriptionItem;
}

let nextReviewId = 0;

function toReviewable(item: ParsedPrescriptionItem): ReviewableItem {
  nextReviewId += 1;
  return {
    id: `review-${nextReviewId}`,
    drugName: item.matchedDrug?.brand_name ?? item.drugNameRaw,
    summary: summarizeDosage(item),
    confidence: item.matchConfidence,
    tier: item.confidenceTier,
    autoMapped: item.autoMapped,
    suggestedGeneric: !item.autoMapped ? (item.matchedDrug?.generic_name ?? null) : null,
    original: item,
  };
}

/** Folds the human's edits back into a ParsedPrescriptionItem by re-running the same deterministic parser the summary text came from. */
function toConfirmedItem(reviewable: ReviewableItem): ParsedPrescriptionItem {
  const normalized = normalizeBengaliDigits(reviewable.summary);
  return {
    ...reviewable.original,
    drugNameRaw: reviewable.drugName,
    doseSchedule: parseDoseSchedule(normalized),
    doseQuantity: parseDoseQuantity(normalized),
    mealRelation: parseMealRelation(normalized),
    duration: parseDuration(normalized),
  };
}

const TIER_STATUS_KEY: Record<ConfidenceTier, StatusKey> = { high: 'taken', medium: 'pending', low: 'missed' };

function ConfidenceBadge({ tier, confidence }: { tier: ConfidenceTier; confidence: number }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const statusKey = TIER_STATUS_KEY[tier];
  return (
    <View className="self-start rounded-full px-3 py-1.5" style={{ backgroundColor: theme.statusTint(statusKey) }}>
      <Text className="text-caption" style={{ color: theme.statusText(statusKey) }}>
        {t('scanRx.reviewSheet.matchPercent', { confidence })}
      </Text>
    </View>
  );
}

interface ReviewCardProps {
  item: ReviewableItem;
  onChange: (patch: Partial<Pick<ReviewableItem, 'drugName' | 'summary'>>) => void;
  onRemove: () => void;
}

function ReviewCard({ item, onChange, onRemove }: ReviewCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View className="gap-3 rounded-3xl border p-6" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
      <View className="flex-row items-center justify-between">
        <ConfidenceBadge tier={item.tier} confidence={item.confidence} />
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('scanRx.reviewSheet.removeAccessibility', { name: item.drugName })}
          className="min-h-hit min-w-hit items-center justify-center"
        >
          <X color={theme.colors.inkMuted} size={20} />
        </Pressable>
      </View>

      <BottomSheetTextInput
        value={item.drugName}
        onChangeText={(text) => onChange({ drugName: text })}
        placeholder={t('scanRx.reviewSheet.drugNamePlaceholder')}
        placeholderTextColor={theme.colors.inkMuted}
        className="min-h-hit rounded-2xl border px-4 text-body-lg"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, color: theme.colors.ink }}
      />
      <BottomSheetTextInput
        value={item.summary}
        onChangeText={(text) => onChange({ summary: text })}
        placeholder={t('scanRx.reviewSheet.summaryPlaceholder')}
        placeholderTextColor={theme.colors.inkMuted}
        className="min-h-hit rounded-2xl border px-4 text-body-lg"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, color: theme.colors.ink }}
      />

      {item.suggestedGeneric ? (
        <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
          {t('scanRx.reviewSheet.lowConfidenceSuggestion', { generic: item.suggestedGeneric })}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Human-in-the-loop verification modal: every OCR'd item is an editable
 * card, never a silently-trusted auto-import — even `autoMapped` (>=70%
 * confidence) items are shown and editable here before anything is written
 * to the medications table. A caregiver can fix a misread name, correct the
 * dosage summary (re-parsed live through the same deterministic engine that
 * produced it), or drop a spurious detection entirely, then confirms the
 * whole batch in one tap.
 */
export const PrescriptionReviewSheet = forwardRef<PrescriptionReviewSheetRef, PrescriptionReviewSheetProps>(function PrescriptionReviewSheetImpl(
  { onConfirm },
  ref,
) {
  const theme = useTheme();
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);
  const [reviewItems, setReviewItems] = useState<ReviewableItem[]>([]);
  const snapPoints = useMemo(() => ['75%'], []);

  useImperativeHandle(
    ref,
    () => ({
      present: (items: ParsedPrescriptionItem[]) => {
        setReviewItems(items.map(toReviewable));
        modalRef.current?.present();
      },
      dismiss: () => modalRef.current?.dismiss(),
    }),
    [],
  );

  const updateItem = useCallback((id: string, patch: Partial<Pick<ReviewableItem, 'drugName' | 'summary'>>) => {
    setReviewItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setReviewItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(reviewItems.map(toConfirmedItem));
    modalRef.current?.dismiss();
  }, [onConfirm, reviewItems]);

  // Rendered via `footerComponent`, not as a plain sibling View after the
  // scroll view: @gorhom/bottom-sheet measures and pins `BottomSheetFooter`
  // to the bottom of the sheet itself, independent of the scroll view's
  // content height. A plain View footer after a BottomSheetScrollView only
  // stays on-screen if the scroll view is correctly height-constrained by
  // its parent at every snap point — fragile in practice — whereas the
  // dedicated footer API guarantees the Confirm button is always visible.
  const renderFooter = useCallback(
    (footerProps: BottomSheetFooterProps) => (
      <BottomSheetFooter {...footerProps} bottomInset={0}>
        <View className="border-t px-6 py-5" style={{ borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}>
          <LargeTextButton
            label={t('scanRx.reviewSheet.confirmButton', { count: reviewItems.length, plural: reviewItems.length === 1 ? '' : 's' })}
            onPress={handleConfirm}
            disabled={reviewItems.length === 0}
          />
        </View>
      </BottomSheetFooter>
    ),
    [handleConfirm, reviewItems.length, t, theme.colors.hairline, theme.colors.surface],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
      footerComponent={renderFooter}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View className="px-6 pb-4">
          <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
            {t('scanRx.reviewSheet.titleCount', { count: reviewItems.length, plural: reviewItems.length === 1 ? '' : 's' })}
          </Text>
          <Text className="mt-1 text-caption" style={{ color: theme.colors.inkSecondary }}>
            {t('scanRx.reviewSheet.subtitle')}
          </Text>
        </View>

        <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140, gap: 16 }}>
          {reviewItems.map((item) => (
            <ReviewCard key={item.id} item={item} onChange={(patch) => updateItem(item.id, patch)} onRemove={() => removeItem(item.id)} />
          ))}
          {reviewItems.length === 0 ? (
            <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
              {t('scanRx.reviewSheet.noItemsLeft')}
            </Text>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
