import React from "react";
import { Text, type TextProps } from "tamagui";

export function H1(props: TextProps) {
  return <Text fontSize={24} fontWeight="900" color="$color" {...props} />;
}

export function Sub(props: TextProps) {
  return <Text marginTop={6} color="$textMuted" {...props} />;
}

export function SectionTitle(props: TextProps) {
  return <Text fontSize={16} fontWeight="900" color="$color" marginBottom={6} {...props} />;
}

export function Muted(props: TextProps) {
  return <Text color="$textMuted" {...props} />;
}
