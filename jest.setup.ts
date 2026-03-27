import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockIonicons = ({ name, ...props }: { name?: string }) =>
    React.createElement(Text, props, name ?? 'icon');

  return {
    Ionicons: MockIonicons,
  };
});
