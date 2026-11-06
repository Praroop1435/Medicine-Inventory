import { View } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: tokens.space[6], gap: tokens.space[1] }}>
      <T size={16} weight="medium">
        {title}
      </T>
      {body ? (
        <T size={14} color={tokens.color.muted} style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
    </View>
  );
}
