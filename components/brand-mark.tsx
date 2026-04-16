import { Image, StyleSheet, View } from 'react-native';

type BrandMarkProps = {
  size?: number;
  withWordmark?: boolean;
  compactWordmark?: boolean;
};

const FULL_LOGO_ASPECT_RATIO = 180 / 40;

export function BrandMark({
  size = 40,
  withWordmark = true,
  compactWordmark = false,
}: BrandMarkProps) {
  const imageHeight = compactWordmark ? Math.round(size * 0.85) : size;
  const imageWidth = withWordmark ? Math.round(imageHeight * FULL_LOGO_ASPECT_RATIO) : imageHeight;
  const source = withWordmark
    ? require('../assets/images/fullLogo.png')
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
