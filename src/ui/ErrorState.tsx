import { View } from 'react-native';
import { Button } from './Button';
import { T } from './Text';
import { tokens } from './tokens';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: tokens.space[6], gap: tokens.space[3] }}>
      <T size={14} color={tokens.color.expired} style={{ textAlign: 'center' }}>
        {message}
      </T>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
