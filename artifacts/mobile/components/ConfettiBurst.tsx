import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const PARTICLE_CONFIGS = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * 2 * Math.PI + (i % 3) * 0.15;
  const distance = 45 + (i % 6) * 12;
  return {
    angle,
    distance,
    color: ["#22C55E", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899"][i % 6],
    size: 6 + (i % 4) * 2,
    rotation: (i * 47) % 360,
    delay: (i % 5) * 40,
  };
});

function ConfettiParticle({
  config,
  trigger,
}: {
  config: (typeof PARTICLE_CONFIGS)[0];
  trigger: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger > 0) {
      anim.setValue(0);
      rotate.setValue(0);
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 950,
          delay: config.delay,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 950,
          delay: config.delay,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [trigger, anim, rotate, config.delay]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.cos(config.angle) * config.distance],
  });
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.sin(config.angle) * config.distance - 10],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 1, 0],
  });
  const scale = anim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.3, 1.2, 0.8],
  });
  const rotateVal = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: [`${config.rotation}deg`, `${config.rotation + 270}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size * 0.3,
          backgroundColor: config.color,
          transform: [{ translateX }, { translateY }, { scale }, { rotate: rotateVal }],
          opacity,
        },
      ]}
    />
  );
}

type Props = {
  trigger: number;
  onComplete?: () => void;
};

export function ConfettiBurst({ trigger, onComplete }: Props) {
  useEffect(() => {
    if (trigger > 0 && onComplete) {
      const t = setTimeout(onComplete, 1200);
      return () => clearTimeout(t);
    }
  }, [trigger, onComplete]);

  if (trigger === 0) return null;

  return (
    <View
      style={styles.container}
      pointerEvents="none"
    >
      {PARTICLE_CONFIGS.map((config, i) => (
        <ConfettiParticle key={i} config={config} trigger={trigger} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  particle: {
    position: "absolute",
  },
});
