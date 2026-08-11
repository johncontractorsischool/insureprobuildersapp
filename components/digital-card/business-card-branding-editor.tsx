import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { theme } from '@/constants/theme';
import { DIGITAL_CARD_COLOR_SWATCHES, getDigitalCardPrimaryColor } from '@/utils/digital-card-branding';

type BusinessCardBrandingEditorProps = {
  imageUri: string | null;
  primaryColor: string;
  colorError?: string;
  imageError?: string;
  onChooseLogo: () => void;
  onRemoveLogo: () => void;
  onChangeColor: (value: string) => void;
  onResetBranding: () => void;
};

export function BusinessCardBrandingEditor({
  imageUri,
  primaryColor,
  colorError,
  imageError,
  onChooseLogo,
  onRemoveLogo,
  onChangeColor,
  onResetBranding,
}: BusinessCardBrandingEditorProps) {
  const resolvedColor = getDigitalCardPrimaryColor(primaryColor);

  return (
    <View style={styles.wrapper}>
      <View style={styles.logoRow}>
        <View
          style={styles.logoPreview}
          accessibilityLabel={imageUri ? 'Current card logo' : 'Logo fallback preview'}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.logoImage} contentFit="contain" />
          ) : (
            <View style={[styles.logoFallback, { backgroundColor: `${resolvedColor}14` }]}>
              <Ionicons name="business-outline" size={26} color={resolvedColor} />
            </View>
          )}
        </View>
        <View style={styles.logoActions}>
          <Text style={styles.logoTitle}>Company logo</Text>
          <Text style={styles.helperText}>JPEG, PNG, or WebP under 2 MB. Transparent PNG logos work best.</Text>
          {imageError ? <Text style={styles.errorText}>{imageError}</Text> : null}
          <View style={styles.logoButtonRow}>
            <View style={styles.logoButton}>
              <AppButton
                label={imageUri ? 'Change logo' : 'Upload logo'}
                variant="secondary"
                onPress={onChooseLogo}
              />
            </View>
            {imageUri ? (
              <View style={styles.logoButton}>
                <AppButton label="Remove logo" variant="ghost" onPress={onRemoveLogo} />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.colorStack}>
        <Text style={styles.fieldLabel}>Brand color</Text>
        <View style={styles.swatches}>
          {DIGITAL_CARD_COLOR_SWATCHES.map((swatch) => {
            const selected = swatch === resolvedColor;
            return (
              <Pressable
                key={swatch}
                accessibilityRole="button"
                accessibilityLabel={`Use brand color ${swatch}`}
                accessibilityState={{ selected }}
                onPress={() => onChangeColor(swatch)}
                style={({ pressed }) => [
                  styles.swatch,
                  { backgroundColor: swatch },
                  selected ? styles.swatchSelected : null,
                  pressed ? styles.swatchPressed : null,
                ]}>
                {selected ? <Ionicons name="checkmark" size={18} color={theme.colors.white} /> : null}
              </Pressable>
            );
          })}
        </View>
        <AppInput
          label="Custom hex color"
          value={primaryColor}
          onChangeText={onChangeColor}
          autoCapitalize="characters"
          autoCorrect={false}
          leftIcon="color-palette-outline"
          placeholder="#0B5B47"
          errorText={colorError}
          helperText="Use a six-digit hex value."
        />
      </View>

      <AppButton label="Reset branding" variant="ghost" onPress={onResetBranding} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.md,
  },
  logoRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  logoPreview: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.surface,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoActions: {
    flex: 1,
    minWidth: 220,
    gap: theme.spacing.xs,
  },
  logoTitle: {
    ...theme.typography.body,
    color: theme.colors.textStrong,
    fontWeight: '800',
  },
  helperText: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
  },
  logoButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  logoButton: {
    minWidth: 136,
  },
  colorStack: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.surface,
  },
  swatchSelected: {
    borderColor: theme.colors.textStrong,
  },
  swatchPressed: {
    opacity: 0.8,
  },
});
