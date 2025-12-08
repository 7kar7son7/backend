import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/services/fcm_service.dart';
import '../core/services/local_notifications_service.dart';
import '../core/services/reminder_service.dart';
import '../core/services/timezone_service.dart';
import '../firebase_options.dart';
import 'app.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  await TimezoneService.initialize();
  await _initializeFirebase();
  await LocalNotificationsService.initialize();
  
  // Inicjalizuj dzienną przypominajkę
  await ReminderService.initializeDailyReminder();

  runApp(const ProviderScope(child: App()));
}

Future<void> _initializeFirebase() async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await FcmService.initialize();
  } on FirebaseException catch (error, stackTrace) {
    debugPrint('⚠️ Firebase initialization failed: ${error.message}');
    debugPrintStack(stackTrace: stackTrace);
  } catch (error, stackTrace) {
    debugPrint('⚠️ Firebase initialization encountered an issue: $error');
    debugPrintStack(stackTrace: stackTrace);
  }
}
