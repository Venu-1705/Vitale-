import { Stack } from "expo-router";

export default function ResourcesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="shop/index" />
      <Stack.Screen name="shop/category/[slug]" />
      <Stack.Screen name="shop/product/[id]" />
      <Stack.Screen name="shop/cart" />
      <Stack.Screen name="shop/checkout" />
      <Stack.Screen name="shop/confirmation" />
      <Stack.Screen name="lab/index" />
      <Stack.Screen name="lab/package/[slug]" />
      <Stack.Screen name="lab/book" />
      <Stack.Screen name="lab/confirmation" />
      <Stack.Screen name="lab/reports" />
      <Stack.Screen name="lab/report/[id]" />
    </Stack>
  );
}
