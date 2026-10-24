import AVFoundation
import MediaPlayer
import UIKit

final class LocalPlayer: NSObject, AVAudioPlayerDelegate {
  static let shared = LocalPlayer()

  var onUpdate: (([String: Any]) -> Void)?

  private var player: AVAudioPlayer?
  private var timer: Timer?
  private var finished = false
  private var wantsPlayback = false
  private var resumeAfterInterruption = false
  private var interruptedAt: TimeInterval?
  private var ignoreRemotePlayUntil = Date.distantPast
  private var episodeTitle = ""
  private var showTitle = ""

  private override init() {
    super.init()
    installRemoteCommands()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption(_:)),
      name: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance()
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(noteAppOpened),
      name: UIApplication.didBecomeActiveNotification,
      object: nil
    )
  }

  @objc private func noteAppOpened() {
    ignoreRemotePlayUntil = Date().addingTimeInterval(1.5)
  }

  private func remotePlayFromUser() -> Bool {
    Date() >= ignoreRemotePlayUntil
  }

  func play(uri: String, positionMillis: Double, title: String, showTitle: String) throws -> [String: Any] {
    let loaded = try load(uri: uri, positionMillis: positionMillis, title: title, showTitle: showTitle)
    return try onMain {
      let session = AVAudioSession.sharedInstance()
      try session.setActive(true)
      guard let player = self.player, player.play() else {
        throw playbackError("播放器沒有開始。")
      }
      self.wantsPlayback = true
      self.startTimer()
      self.publishNowPlaying()
      var status = self.snapshotOnMain()
      if let filename = loaded["filename"] {
        status["filename"] = filename
      }
      return status
    }
  }

  func load(uri: String, positionMillis: Double, title: String, showTitle: String) throws -> [String: Any] {
    try onMain {
      self.stopTimer()
      self.player?.stop()
      self.player = nil
      self.finished = false
      self.episodeTitle = title
      self.showTitle = showTitle

      let url = try self.correctedURL(try self.playableURL(uri))
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)

      let next = try AVAudioPlayer(contentsOf: url)
      next.delegate = self
      next.prepareToPlay()
      let start = positionMillis / 1000
      if start > 0.5 && (next.duration <= 0 || start < next.duration - 0.5) {
        next.currentTime = start
      }
      self.player = next
      self.wantsPlayback = false
      self.resumeAfterInterruption = false
      self.interruptedAt = nil
      self.clearNowPlaying()
      var status = self.snapshotOnMain()
      status["filename"] = url.lastPathComponent
      return status
    }
  }

  func pause() -> [String: Any] {
    onMain {
      self.wantsPlayback = false
      self.resumeAfterInterruption = false
      self.player?.pause()
      self.stopTimer()
      self.publishNowPlaying()
      let status = self.snapshotOnMain()
      self.emit(status)
      return status
    }
  }

  func resume() throws -> [String: Any] {
    try onMain {
      guard let player = self.player else {
        throw playbackError("還沒有載入音檔。")
      }
      self.finished = false
      if self.interruptedAt == nil && player.duration > 0 && player.currentTime >= player.duration - 0.5 {
        player.currentTime = 0
      }
      try AVAudioSession.sharedInstance().setActive(true)
      self.pinInterruptedTime(player)
      guard player.play() else {
        throw playbackError("播放器沒有開始。")
      }
      self.wantsPlayback = true
      self.resumeAfterInterruption = false
      self.pinInterruptedTime(player)
      self.interruptedAt = nil
      self.startTimer()
      self.publishNowPlaying()
      let status = self.snapshotOnMain()
      self.emit(status)
      return status
    }
  }

  func seek(to positionMillis: Double) -> [String: Any] {
    onMain {
      self.interruptedAt = nil
      guard let player = self.player else { return self.snapshotOnMain() }
      let seconds = max(0, positionMillis / 1000)
      let limit = player.duration > 0 ? max(0, player.duration - 0.5) : seconds
      player.currentTime = min(seconds, limit)
      self.finished = false
      self.publishNowPlaying()
      let status = self.snapshotOnMain()
      self.emit(status)
      return status
    }
  }

  func stop() {
    onMain {
      self.wantsPlayback = false
      self.resumeAfterInterruption = false
      self.interruptedAt = nil
      self.stopTimer()
      self.player?.stop()
      self.player = nil
      self.finished = false
      self.clearNowPlaying()
    }
  }

  func snapshot() -> [String: Any] {
    onMain { self.snapshotOnMain() }
  }

  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    wantsPlayback = false
    resumeAfterInterruption = false
    finished = flag
    stopTimer()
    publishNowPlaying()
    emit(snapshotOnMain())
  }

  @objc private func handleInterruption(_ notification: Notification) {
    DispatchQueue.main.async { [weak self] in
      self?.applyInterruption(notification)
    }
  }

  private func applyInterruption(_ notification: Notification) {
    guard
      let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? NSNumber,
      let type = AVAudioSession.InterruptionType(rawValue: rawType.uintValue)
    else { return }
    switch type {
    case .began:
      resumeAfterInterruption = wantsPlayback
      guard wantsPlayback, let player else { return }
      interruptedAt = player.currentTime
      player.pause()
      stopTimer()
      publishNowPlaying()
      var status = snapshotOnMain()
      status["playing"] = false
      status["positionMillis"] = (interruptedAt ?? player.currentTime) * 1000
      emit(status)
    case .ended:
      guard resumeAfterInterruption, wantsPlayback else {
        resumeAfterInterruption = false
        return
      }
      resumeAfterInterruption = false
      guard interruptionShouldResume(notification) else { return }
      resumeInterruptedPlayback()
    @unknown default:
      break
    }
  }

  private func resumeInterruptedPlayback() {
    guard let player else { return }
    do {
      try AVAudioSession.sharedInstance().setActive(true)
      pinInterruptedTime(player)
    } catch {
      wantsPlayback = false
      emit(snapshotOnMain())
      return
    }
    guard player.play() else {
      wantsPlayback = false
      emit(snapshotOnMain())
      return
    }
    pinInterruptedTime(player)
    interruptedAt = nil
    startTimer()
    publishNowPlaying()
    emit(snapshotOnMain())
  }

  func seek(by seconds: Double) -> [String: Any] {
    onMain {
      guard let player = self.player else { return self.snapshotOnMain() }
      return self.seek(to: (player.currentTime + seconds) * 1000)
    }
  }

  private func pinInterruptedTime(_ player: AVAudioPlayer) {
    guard let interruptedAt else { return }
    let rewound = max(0, interruptedAt - 1)
    let limit = player.duration > 0 ? max(0, player.duration - 0.5) : rewound
    player.currentTime = min(rewound, limit)
  }

  private func publishNowPlaying() {
    guard let player else {
      clearNowPlaying()
      return
    }
    let playingNow = wantsPlayback && player.isPlaying
    MPNowPlayingInfoCenter.default().nowPlayingInfo = [
      MPMediaItemPropertyTitle: episodeTitle.isEmpty ? "奧笛流" : episodeTitle,
      MPMediaItemPropertyArtist: showTitle,
      MPMediaItemPropertyPlaybackDuration: player.duration,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime,
      MPNowPlayingInfoPropertyPlaybackRate: playingNow ? 1.0 : 0.0,
    ]
  }

  private func clearNowPlaying() {
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  private func installRemoteCommands() {
    UIApplication.shared.beginReceivingRemoteControlEvents()
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true
    center.togglePlayPauseCommand.isEnabled = true
    center.skipBackwardCommand.isEnabled = true
    center.skipForwardCommand.isEnabled = true
    center.changePlaybackPositionCommand.isEnabled = true
    center.skipBackwardCommand.preferredIntervals = [NSNumber(value: 15)]
    center.skipForwardCommand.preferredIntervals = [NSNumber(value: 30)]

    center.playCommand.addTarget { [weak self] _ in
      guard let self, self.remotePlayFromUser() else { return .success }
      do {
        _ = try self.resume()
        return .success
      } catch {
        return .commandFailed
      }
    }
    center.pauseCommand.addTarget { [weak self] _ in
      guard let self, self.player != nil else { return .commandFailed }
      _ = self.pause()
      return .success
    }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self, self.player != nil else { return .commandFailed }
      if self.wantsPlayback && self.player?.isPlaying == true {
        _ = self.pause()
      } else {
        guard self.remotePlayFromUser() else { return .success }
        do {
          _ = try self.resume()
        } catch {
          return .commandFailed
        }
      }
      return .success
    }
    center.skipBackwardCommand.addTarget { [weak self] _ in
      guard let self, self.player != nil else { return .commandFailed }
      _ = self.seek(by: -15)
      return .success
    }
    center.skipForwardCommand.addTarget { [weak self] _ in
      guard let self, self.player != nil else { return .commandFailed }
      _ = self.seek(by: 30)
      return .success
    }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard
        let self,
        self.player != nil,
        let position = event as? MPChangePlaybackPositionCommandEvent
      else { return .commandFailed }
      _ = self.seek(to: position.positionTime * 1000)
      return .success
    }
  }

  private func playableURL(_ uri: String) throws -> URL {
    let url: URL
    if let parsed = URL(string: uri), parsed.isFileURL {
      url = parsed
    } else {
      url = URL(fileURLWithPath: uri)
    }
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw playbackError("手機上找不到這一集的音檔。")
    }
    try? FileManager.default.setAttributes(
      [.protectionKey: FileProtectionType.none],
      ofItemAtPath: url.path
    )
    return url
  }

  private func correctedURL(_ url: URL) throws -> URL {
    let handle = try FileHandle(forReadingFrom: url)
    let data = try handle.read(upToCount: 32) ?? Data()
    try handle.close()
    guard let ext = audioExtension([UInt8](data)) else { return url }
    if url.pathExtension.lowercased() == ext { return url }
    let renamed = url.deletingPathExtension().appendingPathExtension(ext)
    if FileManager.default.fileExists(atPath: renamed.path) {
      try? FileManager.default.removeItem(at: renamed)
    }
    try FileManager.default.moveItem(at: url, to: renamed)
    try? FileManager.default.setAttributes(
      [.protectionKey: FileProtectionType.none],
      ofItemAtPath: renamed.path
    )
    return renamed
  }

  private func snapshotOnMain() -> [String: Any] {
    guard let player else {
      return [
        "playing": false,
        "positionMillis": 0,
        "durationMillis": 0,
        "finished": finished,
      ]
    }
    return [
      "playing": player.isPlaying,
      "positionMillis": player.currentTime * 1000,
      "durationMillis": player.duration * 1000,
      "finished": finished,
    ]
  }

  private func emit(_ status: [String: Any]) {
    onUpdate?(status)
  }

  private func startTimer() {
    stopTimer()
    let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
      guard let self else { return }
      self.emit(self.snapshotOnMain())
    }
    RunLoop.main.add(timer, forMode: .common)
    self.timer = timer
  }

  private func stopTimer() {
    timer?.invalidate()
    timer = nil
  }

  private func onMain<T>(_ work: () throws -> T) rethrows -> T {
    if Thread.isMainThread {
      return try work()
    }
    return try DispatchQueue.main.sync(execute: work)
  }
}

private func audioExtension(_ bytes: [UInt8]) -> String? {
  guard bytes.count >= 12 else { return nil }
  if bytes.starts(with: [0x49, 0x44, 0x33]) { return "mp3" }
  if bytes.starts(with: Array("fLaC".utf8)) { return "flac" }
  if bytes.starts(with: Array("OggS".utf8)) { return "ogg" }
  if bytes.starts(with: Array("RIFF".utf8)) { return "wav" }
  if let text = String(bytes: bytes, encoding: .isoLatin1), text.contains("ftyp") { return "m4a" }
  if bytes[0] == 0xff && (bytes[1] & 0xe0) == 0xe0 { return "mp3" }
  return nil
}

private func interruptionShouldResume(_ notification: Notification) -> Bool {
  guard let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? NSNumber else {
    return true
  }
  return AVAudioSession.InterruptionOptions(rawValue: rawOptions.uintValue).contains(.shouldResume)
}

private func playbackError(_ message: String) -> NSError {
  NSError(domain: "LocalPlayer", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}
