// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'channel_api.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ChannelProgramsDtoImpl _$$ChannelProgramsDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$ChannelProgramsDtoImpl(
      channel: ChannelDto.fromJson(json['channel'] as Map<String, dynamic>),
      programs: (json['programs'] as List<dynamic>?)
              ?.map((e) => ProgramDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ProgramDto>[],
    );

Map<String, dynamic> _$$ChannelProgramsDtoImplToJson(
        _$ChannelProgramsDtoImpl instance) =>
    <String, dynamic>{
      'channel': instance.channel,
      'programs': instance.programs,
    };

// **************************************************************************
// RetrofitGenerator
// **************************************************************************

// ignore_for_file: unnecessary_brace_in_string_interps,no_leading_underscores_for_local_identifiers,unused_element

class _ChannelApi implements ChannelApi {
  _ChannelApi(
    this._dio, {
    this.baseUrl,
    this.errorLogger,
  });

  final Dio _dio;

  String? baseUrl;

  final ParseErrorLogger? errorLogger;

  @override
  Future<ApiResponse<List<ChannelDto>>> getChannels({
    String? search,
    bool? includePrograms,
    int? limit,
    int? offset,
  }) async {
    final _extra = <String, dynamic>{};
    final queryParameters = <String, dynamic>{
      r'search': search,
      r'includePrograms': includePrograms,
      r'limit': limit,
      r'offset': offset,
    };
    queryParameters.removeWhere((k, v) => v == null);
    final _headers = <String, dynamic>{};
    const Map<String, dynamic>? _data = null;
    final _options = _setStreamType<ApiResponse<List<ChannelDto>>>(Options(
      method: 'GET',
      headers: _headers,
      extra: _extra,
    )
        .compose(
          _dio.options,
          '/channels',
          queryParameters: queryParameters,
          data: _data,
        )
        .copyWith(
            baseUrl: _combineBaseUrls(
          _dio.options.baseUrl,
          baseUrl,
        )));
    final _result = await _dio.fetch<Map<String, dynamic>>(_options);
    late ApiResponse<List<ChannelDto>> _value;
    try {
      _value = ApiResponse<List<ChannelDto>>.fromJson(
        _result.data!,
        (json) => json is List<dynamic>
            ? json
                .map<ChannelDto>(
                    (i) => ChannelDto.fromJson(i as Map<String, dynamic>))
                .toList()
            : List.empty(),
      );
    } on Object catch (e, s) {
      errorLogger?.logError(e, s, _options);
      rethrow;
    }
    return _value;
  }

  @override
  Future<ApiResponse<ChannelDto>> getChannel(String channelId) async {
    final _extra = <String, dynamic>{};
    final queryParameters = <String, dynamic>{};
    final _headers = <String, dynamic>{};
    const Map<String, dynamic>? _data = null;
    final _options = _setStreamType<ApiResponse<ChannelDto>>(Options(
      method: 'GET',
      headers: _headers,
      extra: _extra,
    )
        .compose(
          _dio.options,
          '/channels/${channelId}',
          queryParameters: queryParameters,
          data: _data,
        )
        .copyWith(
            baseUrl: _combineBaseUrls(
          _dio.options.baseUrl,
          baseUrl,
        )));
    final _result = await _dio.fetch<Map<String, dynamic>>(_options);
    late ApiResponse<ChannelDto> _value;
    try {
      _value = ApiResponse<ChannelDto>.fromJson(
        _result.data!,
        (json) => ChannelDto.fromJson(json as Map<String, dynamic>),
      );
    } on Object catch (e, s) {
      errorLogger?.logError(e, s, _options);
      rethrow;
    }
    return _value;
  }

  @override
  Future<ApiResponse<ChannelProgramsDto>> getChannelPrograms(
    String channelId, {
    DateTime? from,
    DateTime? to,
  }) async {
    final _extra = <String, dynamic>{};
    final queryParameters = <String, dynamic>{
      r'from': from?.toIso8601String(),
      r'to': to?.toIso8601String(),
    };
    queryParameters.removeWhere((k, v) => v == null);
    final _headers = <String, dynamic>{};
    const Map<String, dynamic>? _data = null;
    final _options = _setStreamType<ApiResponse<ChannelProgramsDto>>(Options(
      method: 'GET',
      headers: _headers,
      extra: _extra,
    )
        .compose(
          _dio.options,
          '/channels/${channelId}/programs',
          queryParameters: queryParameters,
          data: _data,
        )
        .copyWith(
            baseUrl: _combineBaseUrls(
          _dio.options.baseUrl,
          baseUrl,
        )));
    final _result = await _dio.fetch<Map<String, dynamic>>(_options);
    late ApiResponse<ChannelProgramsDto> _value;
    try {
      _value = ApiResponse<ChannelProgramsDto>.fromJson(
        _result.data!,
        (json) => ChannelProgramsDto.fromJson(json as Map<String, dynamic>),
      );
    } on Object catch (e, s) {
      errorLogger?.logError(e, s, _options);
      rethrow;
    }
    return _value;
  }

  RequestOptions _setStreamType<T>(RequestOptions requestOptions) {
    if (T != dynamic &&
        !(requestOptions.responseType == ResponseType.bytes ||
            requestOptions.responseType == ResponseType.stream)) {
      if (T == String) {
        requestOptions.responseType = ResponseType.plain;
      } else {
        requestOptions.responseType = ResponseType.json;
      }
    }
    return requestOptions;
  }

  String _combineBaseUrls(
    String dioBaseUrl,
    String? baseUrl,
  ) {
    if (baseUrl == null || baseUrl.trim().isEmpty) {
      return dioBaseUrl;
    }

    final url = Uri.parse(baseUrl);

    if (url.isAbsolute) {
      return url.toString();
    }

    return Uri.parse(dioBaseUrl).resolveUri(url).toString();
  }
}
