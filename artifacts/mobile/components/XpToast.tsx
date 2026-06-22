import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type Props = {
  points: number;
  trigger: number;
};

export function XpToast({ points, trigger }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (trigger > 0) {
      translateY.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.5);

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, { toValue: 1.1, useNativeDriver: true, tension: 200, friction: 8 }),
          Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -75, duration: 750, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    }
  }, [trigger, translateY, opacity, scale]);

  if (trigger === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <Text style={styles.text}>+{points} XP</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
    backgroundColor: "#22C55E",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 1000,
  },
  text: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
