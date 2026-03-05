# Flutter wrapper
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }
-keep class io.flutter.plugins.**  { *; }

# flutter_local_notifications - zachowaj wszystkie klasy pluginu
-keep class com.dexterous.** { *; }
-keep class com.dexterous.flutterlocalnotifications.** { *; }
-dontwarn com.dexterous.**

# Zachowaj typy generyczne dla serializacji
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Zachowaj klasy używane w refleksji
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Zachowaj klasy związane z powiadomieniami
-keep class * extends android.app.Notification { *; }
-keep class * extends android.app.NotificationManager { *; }
-keep class * extends android.content.BroadcastReceiver { *; }
-keep class * extends android.app.Service { *; }

# Zachowaj klasy związane z serializacją JSON
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Zachowaj wszystkie klasy z pakietu timezone (używane przez plugin)
-keep class org.threeten.bp.** { *; }
-dontwarn org.threeten.bp.**

# Google Play Core - ignoruj brakujące klasy (używane tylko w deferred components)
-dontwarn com.google.android.play.core.splitcompat.**
-dontwarn com.google.android.play.core.splitinstall.**
-dontwarn com.google.android.play.core.tasks.**
-keep class com.google.android.play.core.** { *; }

# Gson - wymagane dla flutter_local_notifications serializacji
-keepattributes Signature
-keepattributes Exceptions
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Zachowaj wszystkie klasy Gson
-keep class com.google.gson.** { *; }
-keep class com.google.gson.reflect.** { *; }
-dontwarn com.google.gson.**

# Zachowaj klasy używane przez Gson w refleksji
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Zachowaj wszystkie klasy używane w serializacji przez plugin
-keep class com.dexterous.flutterlocalnotifications.** { *; }
-keepclassmembers class com.dexterous.flutterlocalnotifications.** {
    *;
}

# Zachowaj typy generyczne dla wszystkich klas pluginu
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# Kluczowe: Zachowaj TypeToken używane przez Gson do serializacji typów generycznych
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class * extends com.google.gson.reflect.TypeToken
-keep class com.google.gson.reflect.TypeToken$* { *; }

# Zachowaj metody getSuperclassTypeParameter używane przez Gson
-keepclassmembers class * {
    java.lang.reflect.Type getSuperclassTypeParameter(java.lang.Class);
}

# Zachowaj wszystkie klasy używane przez plugin w serializacji (w tym wewnętrzne klasy)
-keep class com.dexterous.flutterlocalnotifications.**$* { *; }
-keepclassmembers class com.dexterous.flutterlocalnotifications.**$* {
    *;
}

# AGRESYWNE: Wyłącz optymalizację dla całego pluginu
-dontoptimize
-dontobfuscate
-keep class com.dexterous.flutterlocalnotifications.** { *; }
-keepclassmembers class com.dexterous.flutterlocalnotifications.** { *; }

# Wyłącz optymalizację dla Gson
-keep class com.google.gson.** { *; }
-keepclassmembers class com.google.gson.** { *; }
# Uwaga: -dontoptimize i -dontobfuscate nie przyjmują argumentów class
# Używamy -keep zamiast tego

# Zachowaj wszystkie metody i pola używane przez refleksję
-keepclassmembers class * {
    <methods>;
    <fields>;
}

