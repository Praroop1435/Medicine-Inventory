import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { IconName } from './Icon';
import { IconTile } from './IconTile';
import { T } from './Text';
import { tokens } from './tokens';

/** Icon, title, one line, and the action(s) that get the user out of the empty state. */
export function EmptyState({
  icon = 'package',
  title,
  body,
  children,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', padding: tokens.space[6], gap: tokens.space[2] }}>
      <IconTile icon={icon} size={tokens.emptyIcon} round />
      <T size={16} weight="semibold" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T size={14} color={tokens.color.muted} style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
      {children ? (
        <View style={{ alignSelf: 'stretch', paddingTop: tokens.space[2] }}>{children}</View>
      ) : null}
    </View>
  );
}
