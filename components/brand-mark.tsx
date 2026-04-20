import { Image, StyleSheet, View } from 'react-native';

type BrandMarkProps = {
  size?: number;
  withWordmark?: boolean;
  compactWordmark?: boolean;
};

const FULL_LOGO_ASPECT_RATIO = 1996 / 647;
const BRAND_MARK_SCALE = 1.1;

export function BrandMark({
  size = 40,
  withWordmark = true,
  compactWordmark = false,
}: BrandMarkProps) {
  const baseHeight = compactWordmark ? size * 0.85 : size;
  const imageHeight = Math.round(baseHeight * BRAND_MARK_SCALE);
  const imageWidth = withWordmark ? Math.round(imageHeight * FULL_LOGO_ASPECT_RATIO) : imageHeight;
  const source = withWordmark
    ? require('../assets/images/Logo2.png')
    : require('../assets/images/pbialogo.png');

  return (
    <View style={styles.row}>
      <Image
        source={source}
        style={[
          styles.image,
          {
            width: imageWidth,
            height: imageHeight,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  image: {
    maxWidth: '100%',
  },
});
