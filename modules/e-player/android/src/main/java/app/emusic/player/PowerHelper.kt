package app.emusic.player

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * Battery optimisation and OEM "autostart" screens. Xiaomi, Huawei, Samsung, Oppo and Vivo
 * kill foreground services far more aggressively than stock Android, so the app has to
 * send the user to the right vendor screen.
 */
object PowerHelper {
  // Vendor screens move between OS versions; try each in order until one opens.
  private val autostartComponents = mapOf(
    "xiaomi" to listOf(
      ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
    ),
    "huawei" to listOf(
      ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"),
      ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
    ),
    "honor" to listOf(
      ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
    ),
    "samsung" to listOf(
      ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
      ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity"),
    ),
    "oppo" to listOf(
      ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
      ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
    ),
    "vivo" to listOf(
      ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
      ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
    ),
  )

  fun manufacturer(): String {
    val m = Build.MANUFACTURER.lowercase()
    return when {
      m.contains("xiaomi") || m.contains("redmi") || m.contains("poco") -> "xiaomi"
      m.contains("realme") || m.contains("oneplus") -> "oppo"
      else -> m
    }
  }

  fun deviceInfo(): Map<String, Any?> = mapOf(
    "manufacturer" to manufacturer(),
    "brand" to Build.BRAND,
    "model" to Build.MODEL,
    "sdkInt" to Build.VERSION.SDK_INT,
    "hasAutostartScreen" to autostartComponents.containsKey(manufacturer()),
  )

  fun isIgnoringBatteryOptimizations(context: Context): Boolean {
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(context.packageName)
  }

  // Installed outside the Play Store, so the direct exemption prompt is acceptable here.
  @SuppressLint("BatteryLife")
  fun requestIgnoreBatteryOptimizations(context: Context): Boolean {
    val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
      .setData(Uri.parse("package:${context.packageName}"))
    return tryStart(context, direct) ||
      tryStart(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
  }

  fun openAutostartSettings(context: Context): Boolean {
    val candidates = autostartComponents[manufacturer()].orEmpty()
    return candidates.any { tryStart(context, Intent().setComponent(it)) }
  }

  fun openAppSettings(context: Context): Boolean =
    tryStart(
      context,
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        .setData(Uri.parse("package:${context.packageName}")),
    )

  private fun tryStart(context: Context, intent: Intent): Boolean = try {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
    true
  } catch (_: Exception) {
    // ActivityNotFoundException or SecurityException for non-exported vendor screens.
    false
  }
}
