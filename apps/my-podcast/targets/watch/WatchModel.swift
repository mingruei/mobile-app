import AVFoundation
import Darwin
import MediaPlayer
import SwiftUI
import WatchConnectivity
import WatchKit

struct WatchEpisode: Codable, Identifiable, Equatable {
  var id: String
  var title: String
  var showTitle: String
  var filename: String
  var positionMillis: Double
  var durationMillis: Double
  var completed: Bool
  var bytes: Int64
  /// ISO-8601 from the phone feed; used to match the show's newest/oldest order.
  var publishedAt: String?
  /// `newest` or `oldest`, matching the phone show setting.
  var episodeOrder: String

  init(
    id: String,
    title: String,
    showTitle: String,
    filename: String,
    positionMillis: Double,
    durationMillis: Double,
    completed: Bool,
    bytes: Int64 = 0,
    publishedAt: String? = nil,
    episodeOrder: String = "newest"
  ) {
    self.id = id
    self.title = title
    self.showTitle = showTitle
    self.filename = filename
    self.positionMillis = positionMillis
    self.durationMillis = durationMillis
    self.completed = completed
    self.bytes = bytes
    self.publishedAt = publishedAt
    self.episodeOrder = episodeOrder == "oldest" ? "oldest" : "newest"
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    title = try container.decode(String.self, forKey: .title)
    showTitle = try container.decode(String.self, forKey: .showTitle)
    filename = try container.decode(String.self, forKey: .filename)
    positionMillis = try container.decode(Double.self, forKey: .positionMillis)
    durationMillis = try container.decode(Double.self, forKey: .durationMillis)
    completed = try container.decode(Bool.self, forKey: .completed)
    bytes = try container.decodeIfPresent(Int64.self, forKey: .bytes) ?? 0
    publishedAt = try container.decodeIfPresent(String.self, forKey: .publishedAt)
    let order = try container.decodeIfPresent(String.self, forKey: .episodeOrder) ?? "newest"
    episodeOrder = order == "oldest" ? "oldest" : "newest"
  }
}

struct WatchDownloadProgress: Equatable {
  var written: Int64
  var expected: Int64
}

final class WatchModel: NSObject, ObservableObject, WCSessionDelegate, AVAudioPlayerDelegate {
  @Published private(set) var episodes: [WatchEpisode] = []
  @Published private(set) var downloadingIds = Set<String>()
  @Published private(set) var downloadProgressById: [String: WatchDownloadProgress] = [:]
  @Published private(set) var currentId: String?
  @Published private(set) var playing = false

  private var player: AVAudioPlayer?
  private var timer: Timer?
  private var tickCount = 0
  private var resumeAfterInterruption = false
  private var interruptedAt: TimeInterval?
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  var current: WatchEpisode? {
    guard let currentId else { return nil }
    return episodes.first { $0.id == currentId }
  }

  override init() {
    super.init()
    refreshLibrary()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption(_:)),
      name: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance()
    )
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  func play(_ episode: WatchEpisode) {
    if downloadingIds.contains(episode.id) { return }
    if currentId == episode.id, player != nil {
      if player?.isPlaying == true {
        pause()
      } else {
        startAudio()
      }
      return
    }
    guard load(episode) else { return }
    startAudio()
  }

  func pause() {
    resumeAfterInterruption = false
    player?.pause()
    playing = false
    stopTimer()
    capturePosition(completed: false)
    reportProgress(completed: false)
    publishNowPlaying()
  }

  func seek(_ episode: WatchEpisode, by seconds: Double) {
    if currentId != episode.id || player == nil {
      guard load(episode) else { return }
    }
    seek(by: seconds)
  }

  private func load(_ episode: WatchEpisode) -> Bool {
    stopAudio()
    let url = fileURL(named: episode.filename)
    let size = fileByteCount(url)
    guard size > 0 else { return false }
    if episode.bytes > 0, episode.bytes != size { return false }
    do {
      try configureSession()
      let next = try AVAudioPlayer(contentsOf: url)
      next.delegate = self
      next.prepareToPlay()
      let duration = next.duration * 1000
      let start = episode.completed ? 0 : min(episode.positionMillis / 1000, max(0, next.duration - 0.5))
      next.currentTime = start
      player = next
      currentId = episode.id
      updateEpisode(episode.id, positionMillis: start * 1000, durationMillis: duration, completed: false)
      publishNowPlaying()
      return true
    } catch {
      playing = false
      return false
    }
  }

  func seek(by seconds: Double) {
    guard let player else { return }
    interruptedAt = nil
    let next = min(max(0, player.currentTime + seconds), max(0, player.duration - 0.5))
    player.currentTime = next
    capturePosition(completed: false)
    publishNowPlaying()
  }

  func delete(_ episode: WatchEpisode) {
    discard(episode)
    replaceEpisodes(episodes.filter { $0.id != episode.id })
  }

  private func replaceEpisodes(_ next: [WatchEpisode]) {
    episodes = orderedWatchEpisodes(next)
    persist()
  }

  private func discard(_ episode: WatchEpisode) {
    if currentId == episode.id {
      stopAudio()
      currentId = nil
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
    try? FileManager.default.removeItem(at: fileURL(named: episode.filename))
  }

  func refreshLibrary() {
    let downloading = episodes.filter { downloadingIds.contains($0.id) }
    let saved = loadEpisodes().filter { episode in
      if downloadingIds.contains(episode.id) { return true }
      if episode.completed || isLeftoverTitle(episode) {
        discard(episode)
        return false
      }
      return true
    }
    var byFilename: [String: WatchEpisode] = [:]
    for episode in saved {
      byFilename[episode.filename] = episode
    }
    var kept: [WatchEpisode] = []
    var seen = Set<String>()
    let folder = audioDirectory()
    let urls = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
    for url in urls {
      let name = url.lastPathComponent
      if name.hasPrefix(".")
        || name.hasSuffix(".incoming")
        || name.hasSuffix(".keep")
        || name.hasSuffix(".staged")
        || name.hasSuffix(".part") {
        // .part is an in-flight owned write; never treat it as a finished episode.
        if name.hasSuffix(".part") { continue }
        try? FileManager.default.removeItem(at: url)
        continue
      }
      guard FileManager.default.fileExists(atPath: url.path) else { continue }
      let size = fileByteCount(url)
      if size <= 0 {
        try? FileManager.default.removeItem(at: url)
        continue
      }
      if var episode = byFilename[name] {
        if episode.bytes > 0, episode.bytes != size {
          try? FileManager.default.removeItem(at: url)
          continue
        }
        keepFileReadable(url)
        if episode.bytes <= 0 {
          episode.bytes = size
        }
        seen.insert(name)
        kept.append(episode)
      } else if isCurrentEpisodeFilename(name) {
        seen.insert(name)
      } else {
        try? FileManager.default.removeItem(at: url)
      }
    }
    for episode in saved where !seen.contains(episode.filename) {
      let url = fileURL(named: episode.filename)
      let size = fileByteCount(url)
      if size > 0, episode.bytes <= 0 || episode.bytes == size {
        keepFileReadable(url)
        var next = episode
        if next.bytes <= 0 { next.bytes = size }
        kept.append(next)
      } else if FileManager.default.fileExists(atPath: url.path) {
        try? FileManager.default.removeItem(at: url)
      }
    }
    for episode in downloading where !kept.contains(where: { $0.id == episode.id }) {
      kept.append(episode)
    }
    replaceEpisodes(kept)
  }

  private func reportSaved(_ session: WCSession, episodeId: String, bytes: Int64) {
    let payload: [String: Any] = [
      "watchSaved": episodeId,
      "bytes": NSNumber(value: bytes),
    ]
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
        session.transferUserInfo(payload)
      })
    } else {
      session.transferUserInfo(payload)
    }
  }

  private func reportTransferProblem(_ session: WCSession, error: String, episodeId: String) {
    let payload: [String: Any] = ["error": error, "episodeId": episodeId]
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
        session.transferUserInfo(payload)
      })
    } else {
      session.transferUserInfo(payload)
    }
  }

  private func deleteFromPhone(_ payload: [String: Any]) {
    guard let episodeId = stringValue(payload["deleteEpisodeId"]) else { return }
    DispatchQueue.main.async {
      guard let episode = self.episodes.first(where: { $0.id == episodeId }) else { return }
      self.delete(episode)
    }
  }

  func statusLine(_ episode: WatchEpisode) -> String {
    if downloadingIds.contains(episode.id) {
      return downloadProgressText(episode.id)
    }
    if fileByteCount(fileURL(named: episode.filename)) <= 0 { return "音檔是空的" }
    if episode.completed { return "已聽完" }
    if episode.positionMillis >= 5000 { return "聽到 \(formatTime(episode.positionMillis))" }
    return "在手表裡"
  }

  func isDownloading(_ episodeId: String) -> Bool {
    downloadingIds.contains(episodeId)
  }

  func downloadProgressText(_ episodeId: String) -> String {
    guard let progress = downloadProgressById[episodeId] else {
      return "正在接收…"
    }
    if progress.written <= 0 {
      return "正在接收…"
    }
    if progress.expected > 0 {
      let percent = min(99, Int((Double(progress.written) / Double(progress.expected) * 100).rounded(.down)))
      return "接收 \(percent)% · \(formatByteSize(progress.written)) / \(formatByteSize(progress.expected))"
    }
    return "接收中 \(formatByteSize(progress.written))"
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.refreshLibrary()
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if handleTransferProgress(message) { return }
    deleteFromPhone(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    if handleTransferProgress(userInfo) { return }
    deleteFromPhone(userInfo)
  }

  @discardableResult
  private func handleTransferProgress(_ payload: [String: Any]) -> Bool {
    guard boolValue(payload["watchTransferProgress"]) else { return false }
    let episodeId = stringValue(payload["episodeId"]) ?? "episode"
    let title = stringValue(payload["title"]) ?? "未命名單集"
    let showTitle = stringValue(payload["showTitle"]) ?? ""
    let position = numberValue(payload["positionMillis"])
    let written = int64Value(payload["written"])
    let expected = int64Value(payload["bytes"])
    let publishedAt = stringValue(payload["publishedAt"])
    let episodeOrder = stringValue(payload["episodeOrder"]) == "oldest" ? "oldest" : "newest"
    let ext = "mp3"
    let filename = "\(safeFilename(episodeId)).\(ext)"
    DispatchQueue.main.async {
      // Late progress after a successful save must not wipe a playable row back to 0 bytes.
      if let existing = self.episodes.first(where: { $0.id == episodeId }),
         existing.bytes > 0,
         fileByteCount(self.fileURL(named: existing.filename)) > 0 {
        self.clearTransferProgress(episodeId)
        return
      }
      self.downloadingIds.insert(episodeId)
      self.downloadProgressById[episodeId] = WatchDownloadProgress(
        written: written,
        expected: expected > 0 ? expected : -1
      )
      var list = self.episodes
      if let index = list.firstIndex(where: { $0.id == episodeId }) {
        var next = list[index]
        next.title = title
        next.showTitle = showTitle
        next.positionMillis = position
        if let publishedAt { next.publishedAt = publishedAt }
        next.episodeOrder = episodeOrder
        // Keep filename/bytes from a prior save; only seed filename while still receiving.
        if next.bytes <= 0 {
          next.filename = filename
        }
        list[index] = next
      } else {
        list.append(
          WatchEpisode(
            id: episodeId,
            title: title,
            showTitle: showTitle,
            filename: filename,
            positionMillis: position,
            durationMillis: 0,
            completed: false,
            bytes: 0,
            publishedAt: publishedAt,
            episodeOrder: episodeOrder
          )
        )
      }
      self.episodes = orderedWatchEpisodes(list)
    }
    return true
  }

  private func clearTransferProgress(_ episodeId: String) {
    downloadingIds.remove(episodeId)
    downloadProgressById.removeValue(forKey: episodeId)
  }

  private func removeEmptyPlaceholder(_ episodeId: String) {
    guard let index = episodes.firstIndex(where: { $0.id == episodeId }) else { return }
    let episode = episodes[index]
    guard episode.bytes <= 0 else { return }
    let size = fileByteCount(fileURL(named: episode.filename))
    guard size <= 0 else { return }
    episodes.remove(at: index)
  }

  func session(_ session: WCSession, didReceive file: WCSessionFile) {
    let episodeId = stringValue(file.metadata?["episodeId"]) ?? "episode"
    let title = stringValue(file.metadata?["title"]) ?? "未命名單集"
    let showTitle = stringValue(file.metadata?["showTitle"]) ?? ""
    let position = numberValue(file.metadata?["positionMillis"])
    let startPlayback = file.metadata?["startPlayback"] == nil || boolValue(file.metadata?["startPlayback"])
    let publishedAt = stringValue(file.metadata?["publishedAt"])
    let episodeOrder = stringValue(file.metadata?["episodeOrder"]) == "oldest" ? "oldest" : "newest"
    let ext = file.fileURL.pathExtension.isEmpty ? "mp3" : file.fileURL.pathExtension
    let filename = "\(safeFilename(episodeId)).\(ext)"
    let expectedBytes = int64Value(file.metadata?["bytes"])

    // WCSession inbox files are APFS clones. copyItem/moveItem and writing
    // mmap'd Data can leave a clone that the system later truncates to 0 — after
    // we already told the phone watchSaved. Stream-copy through a private buffer
    // with POSIX read/write so extents are newly allocated, verify size, then
    // reportSaved.
    let accessed = file.fileURL.startAccessingSecurityScopedResource()
    defer {
      if accessed { file.fileURL.stopAccessingSecurityScopedResource() }
    }

    do {
      try FileManager.default.createDirectory(at: audioDirectory(), withIntermediateDirectories: true)
      let savedBytes = try materializeOwnedEpisodeFile(
        from: file.fileURL,
        filename: filename,
        expectedBytes: expectedBytes
      )
      let confirmed = posixFileSize(fileURL(named: filename))
      guard confirmed == savedBytes, confirmed > 0 else {
        try? FileManager.default.removeItem(at: fileURL(named: filename))
        throw CocoaError(.fileReadCorruptFile)
      }
      DispatchQueue.main.async {
        self.clearTransferProgress(episodeId)
        if self.currentId == episodeId {
          self.stopAudio()
        }
        let episode = WatchEpisode(
          id: episodeId,
          title: title,
          showTitle: showTitle,
          filename: filename,
          positionMillis: position,
          durationMillis: 0,
          completed: false,
          bytes: confirmed,
          publishedAt: publishedAt,
          episodeOrder: episodeOrder
        )
        var list = self.episodes
        if let index = list.firstIndex(where: { $0.id == episodeId }) {
          list[index] = episode
        } else {
          list.append(episode)
        }
        self.replaceEpisodes(list)
        self.reportSaved(session, episodeId: episodeId, bytes: confirmed)
        if startPlayback, WKApplication.shared().applicationState == .active {
          self.play(episode)
        }
      }
    } catch let error as CocoaError where error.code == .fileWriteOutOfSpace {
      DispatchQueue.main.async {
        self.clearTransferProgress(episodeId)
        self.removeEmptyPlaceholder(episodeId)
      }
      reportTransferProblem(session, error: "watch-full", episodeId: episodeId)
    } catch {
      DispatchQueue.main.async {
        self.clearTransferProgress(episodeId)
        self.removeEmptyPlaceholder(episodeId)
      }
      reportTransferProblem(session, error: "watch-size", episodeId: episodeId)
    }
  }

  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    DispatchQueue.main.async {
      self.playing = false
      self.stopTimer()
      self.capturePosition(completed: true)
      self.reportProgress(completed: true)
      if let episode = self.current {
        self.delete(episode)
      }
      self.publishNowPlaying()
    }
  }

  private func startAudio() {
    guard let player else { return }
    pinInterruptedTime(player)
    player.play()
    pinInterruptedTime(player)
    interruptedAt = nil
    playing = true
    tickCount = 0
    startTimer()
    publishNowPlaying()
    installRemoteCommands()
  }

  private func stopAudio() {
    resumeAfterInterruption = false
    interruptedAt = nil
    player?.stop()
    player = nil
    playing = false
    stopTimer()
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
      resumeAfterInterruption = playing
      guard playing, let player else { return }
      interruptedAt = player.currentTime
      player.pause()
      pinInterruptedTime(player)
      playing = false
      stopTimer()
      capturePosition(completed: false)
      publishNowPlaying()
    case .ended:
      guard resumeAfterInterruption else { return }
      resumeAfterInterruption = false
      guard interruptionShouldResume(notification) else { return }
      do {
        try configureSession()
      } catch {
        playing = false
        return
      }
      startAudio()
    @unknown default:
      break
    }
  }

  private func pinInterruptedTime(_ player: AVAudioPlayer) {
    guard let interruptedAt else { return }
    let rewound = max(0, interruptedAt - 1)
    let limit = player.duration > 0 ? max(0, player.duration - 0.5) : rewound
    player.currentTime = min(rewound, limit)
  }

  private func configureSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)
    try session.setActive(true)
  }

  private func startTimer() {
    stopTimer()
    let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
      self?.tick()
    }
    RunLoop.main.add(timer, forMode: .common)
    self.timer = timer
  }

  private func stopTimer() {
    timer?.invalidate()
    timer = nil
  }

  private func tick() {
    guard playing else { return }
    tickCount += 1
    capturePosition(completed: false)
    publishNowPlaying()
    if tickCount % 5 == 0 {
      reportProgress(completed: false)
    }
  }

  private func capturePosition(completed: Bool) {
    guard let currentId, let player else { return }
    updateEpisode(
      currentId,
      positionMillis: player.currentTime * 1000,
      durationMillis: player.duration * 1000,
      completed: completed
    )
  }

  private func updateEpisode(_ id: String, positionMillis: Double, durationMillis: Double, completed: Bool) {
    guard let index = episodes.firstIndex(where: { $0.id == id }) else { return }
    episodes[index].positionMillis = positionMillis
    if durationMillis > 0 {
      episodes[index].durationMillis = durationMillis
    }
    episodes[index].completed = completed
    persist()
  }

  private func reportProgress(completed: Bool) {
    guard let episode = current, WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    let payload: [String: Any] = [
      "episodeId": episode.id,
      "positionMillis": episode.positionMillis,
      "durationMillis": episode.durationMillis,
      "completed": completed,
    ]
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
        if completed {
          session.transferUserInfo(payload)
        }
      })
    } else if completed {
      session.transferUserInfo(payload)
    }
    try? session.updateApplicationContext(payload)
  }

  private func publishNowPlaying() {
    guard let episode = current else { return }
    let duration = (player?.duration ?? episode.durationMillis / 1000)
    MPNowPlayingInfoCenter.default().nowPlayingInfo = [
      MPMediaItemPropertyTitle: episode.title,
      MPMediaItemPropertyArtist: episode.showTitle,
      MPMediaItemPropertyPlaybackDuration: duration,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: player?.currentTime ?? episode.positionMillis / 1000,
      MPNowPlayingInfoPropertyPlaybackRate: playing ? 1 : 0,
    ]
  }

  private func installRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true
    center.skipBackwardCommand.isEnabled = true
    center.skipForwardCommand.isEnabled = true
    center.skipBackwardCommand.preferredIntervals = [NSNumber(value: 15)]
    center.skipForwardCommand.preferredIntervals = [NSNumber(value: 30)]
    center.playCommand.removeTarget(nil)
    center.pauseCommand.removeTarget(nil)
    center.skipBackwardCommand.removeTarget(nil)
    center.skipForwardCommand.removeTarget(nil)
    center.playCommand.addTarget { [weak self] _ in
      guard let self, let episode = self.current else { return .commandFailed }
      if !self.playing {
        self.play(episode)
      }
      return .success
    }
    center.pauseCommand.addTarget { [weak self] _ in
      self?.pause()
      return .success
    }
    center.skipBackwardCommand.addTarget { [weak self] _ in
      self?.seek(by: -15)
      return .success
    }
    center.skipForwardCommand.addTarget { [weak self] _ in
      self?.seek(by: 30)
      return .success
    }
  }

  private func persist() {
    guard let data = try? encoder.encode(episodes) else { return }
    try? data.write(to: libraryURL(), options: .atomic)
  }

  private func loadEpisodes() -> [WatchEpisode] {
    guard let data = try? Data(contentsOf: libraryURL()) else { return [] }
    return (try? decoder.decode([WatchEpisode].self, from: data)) ?? []
  }

  private func audioDirectory() -> URL {
    let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    return root.appendingPathComponent("watch-episodes", isDirectory: true)
  }

  private func fileURL(named filename: String) -> URL {
    audioDirectory().appendingPathComponent(filename)
  }

  private func libraryURL() -> URL {
    let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    return root.appendingPathComponent("watch-library.json")
  }

  private func materializeOwnedEpisodeFile(
    from inbox: URL,
    filename: String,
    expectedBytes: Int64
  ) throws -> Int64 {
    let destination = fileURL(named: filename)
    let temp = audioDirectory().appendingPathComponent("\(UUID().uuidString).part")
    try? FileManager.default.removeItem(at: temp)

    let written = try posixCopyFile(from: inbox, to: temp)
    if written <= 0 {
      try? FileManager.default.removeItem(at: temp)
      throw CocoaError(.fileReadCorruptFile)
    }
    if expectedBytes > 0, written != expectedBytes {
      try? FileManager.default.removeItem(at: temp)
      throw CocoaError(.fileReadCorruptFile)
    }
    if posixFileSize(temp) != written {
      try? FileManager.default.removeItem(at: temp)
      throw CocoaError(.fileWriteUnknown)
    }

    if FileManager.default.fileExists(atPath: destination.path) {
      try FileManager.default.removeItem(at: destination)
    }
    let renamed = temp.path.withCString { fromPath in
      destination.path.withCString { toPath in
        rename(fromPath, toPath)
      }
    }
    if renamed != 0 {
      try? FileManager.default.removeItem(at: temp)
      let retry = try posixCopyFile(from: inbox, to: destination)
      guard retry == written else {
        try? FileManager.default.removeItem(at: destination)
        throw CocoaError(.fileWriteUnknown)
      }
    }
    keepFileReadable(destination)
    syncFile(destination)

    let onDisk = posixFileSize(destination)
    guard onDisk == written else {
      try? FileManager.default.removeItem(at: destination)
      throw CocoaError(.fileReadCorruptFile)
    }
    return onDisk
  }
}

/// Byte-for-byte copy through a private buffer so the destination gets new
/// extents instead of an APFS clone of the WCSession inbox.
private func posixCopyFile(from source: URL, to destination: URL) throws -> Int64 {
  let input = open(source.path, O_RDONLY)
  guard input >= 0 else { throw CocoaError(.fileReadNoSuchFile) }
  defer { Darwin.close(input) }

  try? FileManager.default.removeItem(at: destination)
  let output = open(destination.path, O_CREAT | O_WRONLY | O_EXCL, 0o644)
  guard output >= 0 else { throw CocoaError(.fileWriteUnknown) }
  defer {
    _ = fcntl(output, F_FULLFSYNC)
    Darwin.close(output)
  }

  var buffer = [UInt8](repeating: 0, count: 256 * 1024)
  var total: Int64 = 0
  while true {
    let got = buffer.withUnsafeMutableBytes { raw -> Int in
      guard let base = raw.baseAddress else { return -1 }
      return Darwin.read(input, base, raw.count)
    }
    if got < 0 {
      try? FileManager.default.removeItem(at: destination)
      throw CocoaError(.fileReadUnknown)
    }
    if got == 0 { break }

    var offset = 0
    while offset < got {
      let wrote = buffer.withUnsafeBytes { raw -> Int in
        guard let base = raw.baseAddress else { return -1 }
        return Darwin.write(output, base.advanced(by: offset), got - offset)
      }
      if wrote <= 0 {
        try? FileManager.default.removeItem(at: destination)
        throw CocoaError(.fileWriteUnknown)
      }
      offset += wrote
    }
    total += Int64(got)
  }

  try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.none],
    ofItemAtPath: destination.path
  )
  return total
}

private func posixFileSize(_ url: URL) -> Int64 {
  let fd = open(url.path, O_RDONLY)
  guard fd >= 0 else { return 0 }
  defer { Darwin.close(fd) }
  let end = lseek(fd, 0, SEEK_END)
  return end > 0 ? Int64(end) : 0
}

/// Same show together, then by that show's newest/oldest setting (phone default: newest).
private func orderedWatchEpisodes(_ episodes: [WatchEpisode]) -> [WatchEpisode] {
  let iso = ISO8601DateFormatter()
  iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  let isoBasic = ISO8601DateFormatter()
  isoBasic.formatOptions = [.withInternetDateTime]

  func publishedTime(_ value: String?) -> Date? {
    guard let value, !value.isEmpty else { return nil }
    return iso.date(from: value) ?? isoBasic.date(from: value)
  }

  let indexed = episodes.enumerated().map { offset, episode in (offset, episode) }
  return indexed
    .sorted { left, right in
      let showCompare = left.1.showTitle.localizedStandardCompare(right.1.showTitle)
      if showCompare != .orderedSame {
        return showCompare == .orderedAscending
      }

      let order = left.1.episodeOrder == "oldest" || right.1.episodeOrder == "oldest"
        ? "oldest"
        : "newest"
      let leftDate = publishedTime(left.1.publishedAt)
      let rightDate = publishedTime(right.1.publishedAt)
      if let leftDate, let rightDate, leftDate != rightDate {
        return order == "oldest" ? leftDate < rightDate : leftDate > rightDate
      }
      if leftDate != nil, rightDate == nil { return true }
      if leftDate == nil, rightDate != nil { return false }

      let titleCompare = left.1.title.localizedStandardCompare(right.1.title)
      if titleCompare != .orderedSame {
        return titleCompare == .orderedAscending
      }
      return left.0 < right.0
    }
    .map(\.1)
}

private func isLeftoverTitle(_ episode: WatchEpisode) -> Bool {
  let title = episode.title.trimmingCharacters(in: .whitespacesAndNewlines)
  if title.isEmpty || title == episode.filename { return true }
  let stem = (episode.filename as NSString).deletingPathExtension
  if !stem.isEmpty, title == stem { return true }
  if title.unicodeScalars.contains(where: { $0.value == 0xFFFD }) { return true }
  let scalars = Array(title.unicodeScalars)
  for index in scalars.indices {
    let value = scalars[index].value
    if value == 0x00C3 || value == 0x00C2 { return true }
    if index + 1 < scalars.count {
      let next = scalars[index + 1].value
      if (0x00E0...0x00EF).contains(value), (0x0080...0x00BF).contains(next) { return true }
    }
  }
  return false
}

private func isCurrentEpisodeFilename(_ name: String) -> Bool {
  name.range(of: #"^ep_[0-9a-fA-F]{16}\.(mp3|m4a|aac|wav|ogg|flac)$"#, options: .regularExpression) != nil
}

private func safeFilename(_ value: String) -> String {
  let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-"))
  let cleaned = String(value.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
  return cleaned.isEmpty ? "episode" : cleaned
}

private func interruptionShouldResume(_ notification: Notification) -> Bool {
  guard let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? NSNumber else {
    return true
  }
  return AVAudioSession.InterruptionOptions(rawValue: rawOptions.uintValue).contains(.shouldResume)
}

private func stringValue(_ value: Any?) -> String? {
  guard let text = value as? String, !text.isEmpty else { return nil }
  return text
}

private func boolValue(_ value: Any?) -> Bool {
  if let number = value as? NSNumber {
    return number.boolValue
  }
  if let flag = value as? Bool {
    return flag
  }
  return false
}

private func keepFileReadable(_ url: URL) {
  try? FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.none],
    ofItemAtPath: url.path
  )
}

private func syncFile(_ url: URL) {
  let fd = open(url.path, O_RDONLY)
  guard fd >= 0 else { return }
  defer { Darwin.close(fd) }
  _ = fcntl(fd, F_FULLFSYNC)
}

private func fileByteCount(_ url: URL) -> Int64 {
  var counts: [Int64] = []
  if let handle = try? FileHandle(forReadingFrom: url) {
    defer { try? handle.close() }
    if let end = try? handle.seekToEnd() {
      counts.append(Int64(clamping: end))
    }
  }
  if let values = try? url.resourceValues(forKeys: [.fileSizeKey]), let size = values.fileSize {
    counts.append(Int64(size))
  }
  if let attributes = try? FileManager.default.attributesOfItem(atPath: url.path) {
    switch attributes[.size] {
    case let number as NSNumber:
      counts.append(number.int64Value)
    case let value as UInt64:
      counts.append(Int64(clamping: value))
    case let value as Int:
      counts.append(Int64(value))
    case let value as Int64:
      counts.append(value)
    default:
      break
    }
  }
  return counts.filter { $0 > 0 }.max() ?? 0
}

private func int64Value(_ value: Any?) -> Int64 {
  if let number = value as? NSNumber {
    return number.int64Value
  }
  return 0
}

private func numberValue(_ value: Any?) -> Double {
  if let number = value as? NSNumber {
    return number.doubleValue
  }
  if let number = value as? Double {
    return number
  }
  return 0
}

private func formatTime(_ millis: Double) -> String {
  let total = max(0, Int(millis / 1000))
  let hours = total / 3600
  let minutes = (total % 3600) / 60
  let seconds = total % 60
  if hours > 0 {
    return String(format: "%d:%02d:%02d", hours, minutes, seconds)
  }
  return String(format: "%d:%02d", minutes, seconds)
}

private func formatByteSize(_ bytes: Int64) -> String {
  let value = Double(max(0, bytes))
  if value >= 1_048_576 {
    return String(format: "%.1f MB", value / 1_048_576)
  }
  if value >= 1024 {
    return String(format: "%.0f KB", value / 1024)
  }
  return "\(max(0, bytes)) B"
}
