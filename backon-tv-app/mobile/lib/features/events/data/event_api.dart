import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:retrofit/retrofit.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/dio_provider.dart';
import 'event_dto.dart';

part 'event_api.g.dart';

@RestApi()
abstract class EventApi {
  factory EventApi(Dio dio, {String baseUrl}) = _EventApi;

  @GET('/events')
  Future<ApiResponse<List<EventDto>>> getEvents();

  @POST('/events')
  Future<ApiResponse<EventDto>> createEvent(@Body() CreateEventRequest body);

  @POST('/events/{eventId}/confirm')
  Future<ApiResponse<EventConfirmationDto>> confirmEvent(
    @Path() String eventId,
    @Body() ConfirmEventRequest body,
  );
}

final eventApiProvider = Provider.autoDispose<EventApi>((ref) {
  final dio = ref.watch(dioProvider);
  return EventApi(dio);
});

class CreateEventRequest {
  CreateEventRequest({required this.programId});

  final String programId;

  Map<String, dynamic> toJson() => {
        'programId': programId,
      };
}

class ConfirmEventRequest {
  ConfirmEventRequest({
    required this.choice,
    this.reminderUsed = false,
  });

  final EventChoiceDto choice;
  final bool reminderUsed;

  Map<String, dynamic> toJson() => {
        'choice': choice.name,
        'reminderUsed': reminderUsed,
      };
}

