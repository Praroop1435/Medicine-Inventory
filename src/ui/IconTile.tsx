import { View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { tokens } from './tokens';

/** Teal glyph on a soft teal square (list rows) or circle (empty states, Add sheet). */
export function IconTile({
  icon,
  size = tokens.tile,
  round,
}: {
  icon: IconName;
  size?: number;
  round?: boolean;
}) {
  return (
    <View
      testID="icon-tile"
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : tokens.radius.control,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.color.tealSoft,
      }}
    >
      <Icon name={icon} size={size / 2} color={tokens.color.tealInk} />
    </View>
  );
}
