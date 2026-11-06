import { TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  uncertain?: boolean;
  uncertainLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  /** A line under the box: an example value, or how the input was read. */
  hint?: string;
  /** `expired` paints the hint red, e.g. "Already expired". */
  hintTone?: 'muted' | 'expired';
  placeholder?: string;
  maxLength?: number;
};

export function Field({
  label,
  value,
  onChangeText,
  uncertain,
  uncertainLabel,
  keyboardType,
  hint,
  hintTone = 'muted',
  placeholder,
  maxLength,
}: Props) {
  return (
    <View style={{ gap: tokens.space[1] }}>
      <T size={12} weight="medium" color={uncertain ? tokens.color.soon : tokens.color.muted}>
        {label}
      </T>
      <View
        testID="field-box"
        style={{
          minHeight: tokens.touch,
          justifyContent: 'center',
          paddingHorizontal: tokens.space[3],
          borderWidth: 1,
          borderRadius: tokens.radius.control,
          borderColor: uncertain ? tokens.color.amber : tokens.color.control,
          backgroundColor: uncertain ? tokens.color.soonBg : tokens.color.surface,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={tokens.color.muted}
          maxLength={maxLength}
          style={{
            fontSize: tokens.font[16],
            fontFamily: tokens.family.regular,
            color: tokens.color.text,
            padding: 0,
          }}
        />
      </View>
      {uncertain && uncertainLabel ? (
        <T size={12} color={tokens.color.soon}>
          {uncertainLabel}
        </T>
      ) : hint ? (
        <T size={12} color={hintTone === 'expired' ? tokens.color.expired : tokens.color.muted}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}
