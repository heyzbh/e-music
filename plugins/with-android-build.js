// Android build tweaks the generated project needs:
// - NewPipeExtractor uses java.nio/java.time APIs that need core library desugaring below API 33.
// - On Windows, native build intermediates exceed the 260-character path limit:
//   libraries are staged in C:\emb, and the app's CMake hashes long object paths.
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod, withProjectBuildGradle } = require('expo/config-plugins');

const DESUGAR_DEP = "coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.1.5'";
const SHORT_CXX_MARKER = '// e-music: short CMake staging paths';
const SHORT_CXX = `
${SHORT_CXX_MARKER}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  subprojects { p ->
    p.plugins.withId('com.android.library') {
      p.android.externalNativeBuild.cmake.buildStagingDirectory = new File("\${System.getenv('SystemDrive') ?: 'C:'}/emb/\${p.name}")
    }
  }
}
`;

// Same as React Native's default-app-setup, plus a low CMAKE_OBJECT_PATH_MAX. The Android
// Gradle Plugin passes 1024 on the command line; a normal variable here takes precedence.
const APP_CMAKE = `cmake_minimum_required(VERSION 3.13)
project(appmodules)
set(CMAKE_OBJECT_PATH_MAX 240)
include(\${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
`;

function withDesugaring(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('coreLibraryDesugaringEnabled')) {
      src = src.replace(
        /android\s*\{/,
        'android {\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n    }',
      );
    }
    if (!src.includes('desugar_jdk_libs_nio')) {
      src = src.replace(/dependencies\s*\{/, `dependencies {\n    ${DESUGAR_DEP}`);
    }
    if (!src.includes('src/main/jni/CMakeLists.txt')) {
      src = src.replace(
        /android\s*\{/,
        'android {\n    externalNativeBuild {\n        cmake {\n            path "src/main/jni/CMakeLists.txt"\n        }\n    }',
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withAppCmake(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'jni');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'CMakeLists.txt'), APP_CMAKE);
      return cfg;
    },
  ]);
}

function withShortNativePaths(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(SHORT_CXX_MARKER)) {
      cfg.modResults.contents += SHORT_CXX;
    }
    return cfg;
  });
}

module.exports = function withAndroidBuild(config) {
  return withAppCmake(withShortNativePaths(withDesugaring(config)));
};
