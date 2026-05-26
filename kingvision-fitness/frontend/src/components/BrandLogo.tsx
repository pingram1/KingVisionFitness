import React from 'react';
import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

const SOURCE = require('../../assets/kingvision-logo.png');

type BrandLogoProps = {
  /** Override width/height; default is square ~square aspect from asset */
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ style }: BrandLogoProps) {
  return (
    <Image
      source={SOURCE}
      style={[styles.image, style]}
      accessibilityRole="image"
      accessibilityLabel="King Vision Fitness"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 12,
    alignSelf: 'center',
  },
});
