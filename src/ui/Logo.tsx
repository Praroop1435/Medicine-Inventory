import { Image } from 'react-native';

// Decorative: the shop or app name always sits next to it.
const SRC = {
  color: require('../../assets/images/splash-icon.png'),
  white: require('../../assets/images/notification-icon.png'),
};

export function Logo({ size, variant = 'color' }: { size: number; variant?: keyof typeof SRC }) {
  return (
    <Image
      testID={`logo-${variant}`}
      source={SRC[variant]}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
