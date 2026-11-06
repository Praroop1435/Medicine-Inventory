import { Pressable, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import { tokens } from './tokens';

export function SearchField({
  value,
  onChangeText,
  placeholder,
  floating,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** Lifted with a soft shadow, e.g. over the Home header band. */
  floating?: boolean;
}) {
  return (
    <View
      style={{
        height: tokens.touch,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space[2],
        paddingHorizontal: tokens.space[3],
        backgroundColor: tokens.color.surface,
        borderColor: tokens.color.control,
        borderWidth: floating ? 0 : 1,
        borderRadius: tokens.radius.control,
        ...(floating ? tokens.shadow : null),
      }}
    >
      <Icon name="search" color={tokens.color.muted} />
      <TextInput
        accessibilityLabel="Search medicines"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.muted}
        autoCorrect={false}
        style={{
          flex: 1,
          padding: 0,
          fontSize: tokens.font[16],
          fontFamily: tokens.family.regular,
          color: tokens.color.text,
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={{
            width: tokens.touch,
            height: tokens.touch,
            marginRight: -tokens.space[3],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="close" color={tokens.color.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
