// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'program_schedule_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$ScheduledProgram {
  String get channelId => throw _privateConstructorUsedError;
  String get channelName => throw _privateConstructorUsedError;
  String? get channelLogoUrl => throw _privateConstructorUsedError;
  ProgramDto get program => throw _privateConstructorUsedError;
  bool get isFollowed => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $ScheduledProgramCopyWith<ScheduledProgram> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ScheduledProgramCopyWith<$Res> {
  factory $ScheduledProgramCopyWith(
          ScheduledProgram value, $Res Function(ScheduledProgram) then) =
      _$ScheduledProgramCopyWithImpl<$Res, ScheduledProgram>;
  @useResult
  $Res call(
      {String channelId,
      String channelName,
      String? channelLogoUrl,
      ProgramDto program,
      bool isFollowed});

  $ProgramDtoCopyWith<$Res> get program;
}

/// @nodoc
class _$ScheduledProgramCopyWithImpl<$Res, $Val extends ScheduledProgram>
    implements $ScheduledProgramCopyWith<$Res> {
  _$ScheduledProgramCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? channelId = null,
    Object? channelName = null,
    Object? channelLogoUrl = freezed,
    Object? program = null,
    Object? isFollowed = null,
  }) {
    return _then(_value.copyWith(
      channelId: null == channelId
          ? _value.channelId
          : channelId // ignore: cast_nullable_to_non_nullable
              as String,
      channelName: null == channelName
          ? _value.channelName
          : channelName // ignore: cast_nullable_to_non_nullable
              as String,
      channelLogoUrl: freezed == channelLogoUrl
          ? _value.channelLogoUrl
          : channelLogoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      program: null == program
          ? _value.program
          : program // ignore: cast_nullable_to_non_nullable
              as ProgramDto,
      isFollowed: null == isFollowed
          ? _value.isFollowed
          : isFollowed // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }

  @override
  @pragma('vm:prefer-inline')
  $ProgramDtoCopyWith<$Res> get program {
    return $ProgramDtoCopyWith<$Res>(_value.program, (value) {
      return _then(_value.copyWith(program: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ScheduledProgramImplCopyWith<$Res>
    implements $ScheduledProgramCopyWith<$Res> {
  factory _$$ScheduledProgramImplCopyWith(_$ScheduledProgramImpl value,
          $Res Function(_$ScheduledProgramImpl) then) =
      __$$ScheduledProgramImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String channelId,
      String channelName,
      String? channelLogoUrl,
      ProgramDto program,
      bool isFollowed});

  @override
  $ProgramDtoCopyWith<$Res> get program;
}

/// @nodoc
class __$$ScheduledProgramImplCopyWithImpl<$Res>
    extends _$ScheduledProgramCopyWithImpl<$Res, _$ScheduledProgramImpl>
    implements _$$ScheduledProgramImplCopyWith<$Res> {
  __$$ScheduledProgramImplCopyWithImpl(_$ScheduledProgramImpl _value,
      $Res Function(_$ScheduledProgramImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? channelId = null,
    Object? channelName = null,
    Object? channelLogoUrl = freezed,
    Object? program = null,
    Object? isFollowed = null,
  }) {
    return _then(_$ScheduledProgramImpl(
      channelId: null == channelId
          ? _value.channelId
          : channelId // ignore: cast_nullable_to_non_nullable
              as String,
      channelName: null == channelName
          ? _value.channelName
          : channelName // ignore: cast_nullable_to_non_nullable
              as String,
      channelLogoUrl: freezed == channelLogoUrl
          ? _value.channelLogoUrl
          : channelLogoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      program: null == program
          ? _value.program
          : program // ignore: cast_nullable_to_non_nullable
              as ProgramDto,
      isFollowed: null == isFollowed
          ? _value.isFollowed
          : isFollowed // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$ScheduledProgramImpl implements _ScheduledProgram {
  const _$ScheduledProgramImpl(
      {required this.channelId,
      required this.channelName,
      this.channelLogoUrl,
      required this.program,
      required this.isFollowed});

  @override
  final String channelId;
  @override
  final String channelName;
  @override
  final String? channelLogoUrl;
  @override
  final ProgramDto program;
  @override
  final bool isFollowed;

  @override
  String toString() {
    return 'ScheduledProgram(channelId: $channelId, channelName: $channelName, channelLogoUrl: $channelLogoUrl, program: $program, isFollowed: $isFollowed)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ScheduledProgramImpl &&
            (identical(other.channelId, channelId) ||
                other.channelId == channelId) &&
            (identical(other.channelName, channelName) ||
                other.channelName == channelName) &&
            (identical(other.channelLogoUrl, channelLogoUrl) ||
                other.channelLogoUrl == channelLogoUrl) &&
            (identical(other.program, program) || other.program == program) &&
            (identical(other.isFollowed, isFollowed) ||
                other.isFollowed == isFollowed));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType, channelId, channelName, channelLogoUrl, program, isFollowed);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$ScheduledProgramImplCopyWith<_$ScheduledProgramImpl> get copyWith =>
      __$$ScheduledProgramImplCopyWithImpl<_$ScheduledProgramImpl>(
          this, _$identity);
}

abstract class _ScheduledProgram implements ScheduledProgram {
  const factory _ScheduledProgram(
      {required final String channelId,
      required final String channelName,
      final String? channelLogoUrl,
      required final ProgramDto program,
      required final bool isFollowed}) = _$ScheduledProgramImpl;

  @override
  String get channelId;
  @override
  String get channelName;
  @override
  String? get channelLogoUrl;
  @override
  ProgramDto get program;
  @override
  bool get isFollowed;
  @override
  @JsonKey(ignore: true)
  _$$ScheduledProgramImplCopyWith<_$ScheduledProgramImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$ProgramScheduleState {
  DateTime get selectedDate => throw _privateConstructorUsedError;
  List<ScheduledProgram> get programs => throw _privateConstructorUsedError;
  bool get hasChannelFollows => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $ProgramScheduleStateCopyWith<ProgramScheduleState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProgramScheduleStateCopyWith<$Res> {
  factory $ProgramScheduleStateCopyWith(ProgramScheduleState value,
          $Res Function(ProgramScheduleState) then) =
      _$ProgramScheduleStateCopyWithImpl<$Res, ProgramScheduleState>;
  @useResult
  $Res call(
      {DateTime selectedDate,
      List<ScheduledProgram> programs,
      bool hasChannelFollows});
}

/// @nodoc
class _$ProgramScheduleStateCopyWithImpl<$Res,
        $Val extends ProgramScheduleState>
    implements $ProgramScheduleStateCopyWith<$Res> {
  _$ProgramScheduleStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? selectedDate = null,
    Object? programs = null,
    Object? hasChannelFollows = null,
  }) {
    return _then(_value.copyWith(
      selectedDate: null == selectedDate
          ? _value.selectedDate
          : selectedDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      programs: null == programs
          ? _value.programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<ScheduledProgram>,
      hasChannelFollows: null == hasChannelFollows
          ? _value.hasChannelFollows
          : hasChannelFollows // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProgramScheduleStateImplCopyWith<$Res>
    implements $ProgramScheduleStateCopyWith<$Res> {
  factory _$$ProgramScheduleStateImplCopyWith(_$ProgramScheduleStateImpl value,
          $Res Function(_$ProgramScheduleStateImpl) then) =
      __$$ProgramScheduleStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {DateTime selectedDate,
      List<ScheduledProgram> programs,
      bool hasChannelFollows});
}

/// @nodoc
class __$$ProgramScheduleStateImplCopyWithImpl<$Res>
    extends _$ProgramScheduleStateCopyWithImpl<$Res, _$ProgramScheduleStateImpl>
    implements _$$ProgramScheduleStateImplCopyWith<$Res> {
  __$$ProgramScheduleStateImplCopyWithImpl(_$ProgramScheduleStateImpl _value,
      $Res Function(_$ProgramScheduleStateImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? selectedDate = null,
    Object? programs = null,
    Object? hasChannelFollows = null,
  }) {
    return _then(_$ProgramScheduleStateImpl(
      selectedDate: null == selectedDate
          ? _value.selectedDate
          : selectedDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      programs: null == programs
          ? _value._programs
          : programs // ignore: cast_nullable_to_non_nullable
              as List<ScheduledProgram>,
      hasChannelFollows: null == hasChannelFollows
          ? _value.hasChannelFollows
          : hasChannelFollows // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$ProgramScheduleStateImpl implements _ProgramScheduleState {
  const _$ProgramScheduleStateImpl(
      {required this.selectedDate,
      required final List<ScheduledProgram> programs,
      required this.hasChannelFollows})
      : _programs = programs;

  @override
  final DateTime selectedDate;
  final List<ScheduledProgram> _programs;
  @override
  List<ScheduledProgram> get programs {
    if (_programs is EqualUnmodifiableListView) return _programs;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_programs);
  }

  @override
  final bool hasChannelFollows;

  @override
  String toString() {
    return 'ProgramScheduleState(selectedDate: $selectedDate, programs: $programs, hasChannelFollows: $hasChannelFollows)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProgramScheduleStateImpl &&
            (identical(other.selectedDate, selectedDate) ||
                other.selectedDate == selectedDate) &&
            const DeepCollectionEquality().equals(other._programs, _programs) &&
            (identical(other.hasChannelFollows, hasChannelFollows) ||
                other.hasChannelFollows == hasChannelFollows));
  }

  @override
  int get hashCode => Object.hash(runtimeType, selectedDate,
      const DeepCollectionEquality().hash(_programs), hasChannelFollows);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$ProgramScheduleStateImplCopyWith<_$ProgramScheduleStateImpl>
      get copyWith =>
          __$$ProgramScheduleStateImplCopyWithImpl<_$ProgramScheduleStateImpl>(
              this, _$identity);
}

abstract class _ProgramScheduleState implements ProgramScheduleState {
  const factory _ProgramScheduleState(
      {required final DateTime selectedDate,
      required final List<ScheduledProgram> programs,
      required final bool hasChannelFollows}) = _$ProgramScheduleStateImpl;

  @override
  DateTime get selectedDate;
  @override
  List<ScheduledProgram> get programs;
  @override
  bool get hasChannelFollows;
  @override
  @JsonKey(ignore: true)
  _$$ProgramScheduleStateImplCopyWith<_$ProgramScheduleStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
