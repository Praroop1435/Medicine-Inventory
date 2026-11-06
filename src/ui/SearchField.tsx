import { Pressable, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import { tokens } from './tokens';

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
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
        borderWidth: 1,
        borderRadius: tokens.radius.control,
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
          hitSlop={tokens.space[2]}
        >
          <Icon name="close" color={tokens.color.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
