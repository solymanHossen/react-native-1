# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in getDefaultProguardFile("proguard-android-optimize.txt")

# React Native & Hermes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# op-sqlite & SQLCipher
-keep class com.op.sqlite.** { *; }
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }
-dontwarn com.op.sqlite.**

# Notifee
-keep class io.invertase.notifee.** { *; }
-keep class app.notifee.core.** { *; }
-dontwarn io.invertase.notifee.**
-dontwarn app.notifee.core.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# React Native Keychain
-keep class com.oblador.keychain.** { *; }
-dontwarn com.oblador.keychain.**

# MMKV
-keep class com.tencent.mmkv.** { *; }
-dontwarn com.tencent.mmkv.**

# Vision Camera
-keep class com.mrousavy.camera.** { *; }
-dontwarn com.mrousavy.camera.**

# Shopify Skia
-keep class com.shopify.reactnative.skia.** { *; }
-dontwarn com.shopify.reactnative.skia.**

# ML Kit Text Recognition
-keep class com.google.mlkit.vision.** { *; }
-dontwarn com.google.mlkit.vision.**

