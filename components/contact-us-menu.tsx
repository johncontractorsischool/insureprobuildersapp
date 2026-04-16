import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CONTACT_TOPIC_CONFIG, ContactTopic } from '@/constants/contact-support';
import { theme } from '@/constants/theme';

const MENU_TOPICS: ContactTopic[] = ['support', 'feedback'];

export function ContactUsMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (topic: ContactTopic) => {
    setIsOpen(false);
    router.push({
      pathname: '/contact',
      params: { topic },
    });
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen((value) => !value)}
        style={({ pressed }) => [styles.triggerButton, pressed ? styles.triggerPressed : null]}>
        <Text style={styles.triggerLabel}>Contact Us</Text>
        <Ionicons
          name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={16}
          color={theme.colors.primaryDeep}
        />
      </Pressable>

      {isOpen ? (
        <View style={styles.menu}>
          {MENU_TOPICS.map((topic, index) => (
            <Pressable
              key={topic}
              accessibilityRole="button"
              onPress={() => handleSelect(topic)}
              style={({ pressed }) => [
                styles.menuItem,
                index < MENU_TOPICS.length - 1 ? styles.menuItemBorder : null,
                pressed ? styles.menuItemPressed : null,
              ]}>
              <Text style={styles.menuItemLabel}>{CONTACT_TOPIC_CONFIG[topic].menuLabel}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
    position: 'relative',
    zIndex: 20,
  },
  triggerButton: {
    minHeight: 42,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadows.surface,
  },
  triggerPressed: {
    opacity: 0.94,
  },
  triggerLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.primaryDeep,
    fontWeight: '700',
  },
  menu: {
    position: 'absolute',
    top: 50,
    right: 0,
    minWidth: 180,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadows.elevated,
  },
  menuItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemPressed: {
    backgroundColor: theme.colors.surfaceTint,
  },
  menuItemLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
});
