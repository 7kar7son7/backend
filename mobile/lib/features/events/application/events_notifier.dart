import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/event_api.dart';
import '../data/event_dto.dart';

class EventsNotifier extends AutoDisposeAsyncNotifier<List<EventDto>> {
  late final EventApi _eventApi;

  @override
  Future<List<EventDto>> build() async {
    _eventApi = ref.read(eventApiProvider);
    final response = await _eventApi.getEvents();
    return response.data;
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final response = await _eventApi.getEvents();
      return response.data;
    });
  }

  Future<EventDto> createEvent(String programId) async {
    final response = await _eventApi.createEvent(CreateEventRequest(programId: programId));
    await refresh();
    return response.data;
  }

  Future<EventConfirmationDto> confirmEvent(
    String eventId,
    EventChoiceDto choice, {
    bool reminderUsed = false,
  }) async {
    final response = await _eventApi.confirmEvent(
      eventId,
      ConfirmEventRequest(choice: choice, reminderUsed: reminderUsed),
    );
    await refresh();
    return response.data;
  }
}

final eventsNotifierProvider = AutoDisposeAsyncNotifierProvider<EventsNotifier, List<EventDto>>(
  EventsNotifier.new,
);
