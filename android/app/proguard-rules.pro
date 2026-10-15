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

# App classes
-keep class com.myapp.** { *; }

# ML Kit (Text Recognition & Barcode & Common DI)
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-keep class * implements com.google.firebase.components.ComponentRegistrar { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.internal.mlkit_**

# react-native-html-to-pdf / PDFBox
-keep class com.tom_roush.pdfbox.** { *; }
-dontwarn com.tom_roush.pdfbox.**
-dontwarn com.gemalto.jp2.JP2Decoder

# AndroidX WorkManager & Room & Startup (used by Notifee and Background Tasks)
-keep class androidx.work.** { *; }
-keep class androidx.work.impl.** { *; }
-keep class * extends androidx.work.ListenableWorker { *; }
-keep class androidx.room.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class androidx.startup.** { *; }
-dontwarn androidx.work.**
-dontwarn androidx.room.**
-dontwarn androidx.startup.**


