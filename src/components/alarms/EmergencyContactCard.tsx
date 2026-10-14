import { ChevronRight, Pencil, Phone, Plus, ShieldAlert, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useTranslation } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface EmergencyContactCardProps {
  /** Raw stored caregiver phone number or null if unconfigured */
  phone: string | null;
  /** Optional custom masked string. If omitted, `maskPhone(phone)` is used. */
  maskedPhone?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onAdd?: () => void;
}

/**
 * Masks a phone number to hide all leading digits with bullets ('•') while
 * keeping the last digit of the prefix and the final 4 digits visible,
 * matching the reference design: `•••••••2 3423`.
 */
export function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length <= 4) return trimmed;
  const prefix = digits.slice(0, digits.length - 4);
  const suffix = digits.slice(-4);
  const maskedPrefix = prefix.replace(/\d(?=\d)/g, '•');
  return `${maskedPrefix} ${suffix}`;
}

/**
 * Solid-filled shield badge with an embedded white checkmark, drawn to match
 * the reference design's vivid green medical security glyph.
 */
export function FilledShieldCheck({ size = 24, fillColor = '#059669' }: { size?: number; fillColor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgPath
        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        fill={fillColor}
      />
      <SvgPath d="m9 12 2 2 4-4" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Emergency Contact section card.
 *
 * Implements the exact reference design:
 * - Mint-tinted rounded card container
 * - Circular badge with emerald filled shield and crisp white checkmark
 * - Dark navy bold "Emergency Contact" title with active green status dot
 * - Slate chevron navigation affordance
 * - Explanatory helper text: "If you miss a dose by 15 minutes, we’ll send a quick alert to this person."
 * - Inner pure white card with:
 *   - Soft ice-blue circular phone icon badge
 *   - "Alert recipient" label + masked phone number
 *   - Light blue "Edit" pill button with pencil icon
 *   - Soft pink/red "Delete" icon button with trash icon
 */
export function EmergencyContactCard({
  phone,
  maskedPhone,
  onEdit,
  onDelete,
  onAdd,
}: EmergencyContactCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (!phone) {
    return (
      <View
        className="rounded-[24px] border p-5 shadow-sm"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.hairline,
        }}
      >
        <View className="flex-row items-start gap-3">
          <View
            className="items-center justify-center rounded-2xl"
            style={{ width: 48, height: 48, backgroundColor: theme.alarms.emergency.phoneBadge }}
          >
            <ShieldAlert color={theme.action.base} size={24} strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="text-[19px] font-bold tracking-tight" style={{ color: theme.colors.ink }}>
              {t('alarms.caregiverSection')}
            </Text>
            <Text className="mt-1.5 text-[15px] leading-[22px]" style={{ color: theme.colors.inkMuted }}>
              {t('alarms.caregiverDescription')}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            onAdd?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('alarms.addCaregiverAccessibility')}
          className="mt-4 min-h-hit flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3.5 shadow-sm"
          style={{ backgroundColor: theme.action.base }}
        >
          <Plus color={theme.action.ink} size={19} strokeWidth={2.5} />
          <Text className="text-[16px] font-bold" style={{ color: theme.action.ink }}>
            {t('alarms.addCaregiver')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const displayPhone = maskedPhone ?? maskPhone(phone);

  return (
    <View
      className="rounded-[24px] border p-4"
      style={{
        backgroundColor: theme.alarms.emergency.cardBg,
        borderColor: theme.alarms.emergency.cardBorder,
        shadowColor: theme.alarms.card.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme.alarms.card.shadowOpacity,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      {/* Top Header Row */}
      <Pressable
        onPress={() => {
          triggerHaptic('selection');
          onEdit();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('alarms.editCaregiverAccessibility')}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1 mr-2">
          {/* Circular green badge */}
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 48,
              height: 48,
              backgroundColor: theme.alarms.emergency.badge,
            }}
          >
            <FilledShieldCheck fillColor={theme.alarms.emergency.shield} size={25} />
          </View>

          {/* Title and Active indicator */}
          <View className="ml-3 flex-1">
            <Text
              className="text-[19px] font-bold tracking-tight"
              style={{ color: theme.alarms.card.title }}
            >
              {t('alarms.caregiverSection')}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <View
                className="rounded-full"
                style={{ width: 8, height: 8, backgroundColor: theme.alarms.emergency.dot }}
              />
              <Text
                className="text-[14px] font-semibold"
                style={{ color: theme.alarms.emergency.statusText }}
              >
                {t('alarms.caregiverReady')}
              </Text>
            </View>
          </View>
        </View>

        {/* Chevron on the right */}
        <ChevronRight
          color={theme.alarms.emergency.chevron}
          size={22}
          strokeWidth={2.4}
        />
      </Pressable>

      {/* Description text */}
      <Text
        className="mt-2.5 mb-3.5 text-[15px] leading-[22px]"
        style={{ color: theme.alarms.card.subtitle }}
      >
        {t('alarms.caregiverDescription')}
      </Text>

      {/* Inner White Card */}
      <View
        className="flex-row items-center justify-between rounded-2xl px-3.5 py-3"
        style={{
          backgroundColor: theme.alarms.card.innerBg,
          borderColor: theme.alarms.card.innerBorder,
          borderWidth: 1,
          shadowColor: theme.alarms.card.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.alarms.card.shadowOpacity,
          shadowRadius: 6,
          elevation: 1,
        }}
      >
        {/* Left Side: Phone Icon in light blue circle + Contact Details */}
        <View className="flex-row items-center flex-1 mr-2 gap-3">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              backgroundColor: theme.alarms.emergency.phoneBadge,
            }}
          >
            <Phone color={theme.alarms.emergency.phoneIcon} size={20} strokeWidth={2.2} />
          </View>

          <View className="flex-1">
            <Text
              numberOfLines={1}
              className="text-[13px] font-medium"
              style={{ color: theme.alarms.card.subtitle }}
            >
              {t('alarms.caregiverSavedContact')}
            </Text>
            <Text
              numberOfLines={1}
              className="text-[17.5px] font-bold tracking-tight mt-0.5"
              style={{ color: theme.alarms.card.title }}
            >
              {displayPhone}
            </Text>
          </View>
        </View>

        {/* Right Side: Edit Pill Button & Delete Square Button */}
        <View className="flex-row items-center gap-2">
          {/* Edit Button */}
          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              onEdit();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.editCaregiverAccessibility')}
            className="flex-row items-center gap-1.5 rounded-xl px-3.5 py-2"
            style={{
              backgroundColor: theme.alarms.emergency.editBtnBg,
            }}
          >
            <Pencil color={theme.alarms.emergency.editBtnText} size={15} strokeWidth={2.2} />
            <Text
              className="text-[14px] font-bold"
              style={{ color: theme.alarms.emergency.editBtnText }}
            >
              {t('alarms.editCaregiver')}
            </Text>
          </Pressable>

          {/* Delete Button */}
          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              onDelete();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.clearCaregiverAccessibility')}
            className="items-center justify-center rounded-xl p-2.5"
            style={{
              backgroundColor: theme.alarms.emergency.deleteBtnBg,
            }}
          >
            <Trash2 color={theme.alarms.emergency.deleteBtnIcon} size={17} strokeWidth={2.0} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
