import { Text as RNText, type TextProps } from 'react-native';
import { tokens } from './tokens';

type Props = TextProps & {
  size?: keyof typeof tokens.font;
  weight?: keyof typeof tokens.family;
  color?: string;
};

export function T({
  size = 14,
  weight = 'regular',
  color = tokens.color.text,
  style,
  ...rest
}: Props) {
  return (
    <RNText
      {...rest}
      style={[{ fontSize: tokens.font[size], fontFamily: tokens.family[weight], color }, style]}
    />
  );
}
