import { Pressable } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { tokens } from './tokens';

/** A labelled tick: outlined "✓ Matches" until done, then filled navy "✓ Checked". */
export function TickButton({
  label,
  doneLabel,
  done,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  doneLabel: string;
  done: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const ink = done ? tokens.color.onPrimary : tokens.color.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: done }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: tokens.touch,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space[1],
        paddingHorizontal: tokens.space[4],
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        borderColor: done ? tokens.color.navy : tokens.color.control,
        backgroundColor: done ? tokens.color.navy : tokens.color.surface,
        opacity: pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <Icon name="tick" size={tokens.font[16]} color={ink} />
      <T size={14} weight="medium" color={ink} numberOfLines={1}>
        {done ? doneLabel : label}
      </T>
    </Pressable>
  );
}
