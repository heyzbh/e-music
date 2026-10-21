# NewPipeExtractor: services and parsers are looked up reflectively; keep them whole.
-keep class org.schabi.newpipe.extractor.** { *; }
-dontwarn org.schabi.newpipe.extractor.**

# Rhino (signature deciphering) generates and loads classes at runtime.
-keep class org.mozilla.javascript.** { *; }
-keep class org.mozilla.classfile.ClassFileWriter
-dontwarn org.mozilla.javascript.tools.**
-dontwarn org.mozilla.javascript.engine.**

# Optional dependencies of rhino, rhino-engine and jsoup that Android does not have.
-dontwarn javax.script.**
-dontwarn java.beans.**
-dontwarn jdk.dynalink.**
-dontwarn com.google.re2j.**
-dontwarn javax.annotation.**
-dontwarn org.jspecify.**
