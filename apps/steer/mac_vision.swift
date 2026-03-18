#!/usr/bin/env swift

import AppKit
import CoreGraphics
import Foundation
import Vision

struct OCRBox: Codable {
    let left: Double
    let top: Double
    let width: Double
    let height: Double
    let centerX: Double
    let centerY: Double
}

struct OCRMatch: Codable {
    let text: String
    let confidence: Double
    let box: OCRBox
}

struct OCRResult: Codable {
    let ok: Bool
    let image: String
    let width: Int
    let height: Int
    let matches: [OCRMatch]
}

struct ClickResult: Codable {
    let ok: Bool
    let x: Double
    let y: Double
    let clicks: Int
    let button: String
}

struct DragResult: Codable {
    let ok: Bool
    let fromX: Double
    let fromY: Double
    let toX: Double
    let toY: Double
    let steps: Int
}

struct ScrollResult: Codable {
    let ok: Bool
    let direction: String
    let amount: Int
}

struct ScreenInfo: Codable {
    let index: Int
    let name: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
    let scale: Double
    let isMain: Bool
}

struct ScreensResult: Codable {
    let ok: Bool
    let screens: [ScreenInfo]
}

struct ClipboardResult: Codable {
    let ok: Bool
    let path: String?
    let type: String
}

enum VisionError: Error, LocalizedError {
    case usage(String)
    case imageLoadFailed(String)
    case cgImageUnavailable(String)
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .usage(let message), .imageLoadFailed(let message), .cgImageUnavailable(let message), .requestFailed(let message):
            return message
        }
    }
}

func fail(_ message: String) -> Never {
    fputs("\(message)\n", stderr)
    exit(1)
}

func encodeAndPrint<T: Encodable>(_ value: T) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(value)
    guard let text = String(data: data, encoding: .utf8) else {
        throw VisionError.requestFailed("Failed to encode JSON output")
    }
    print(text)
}

func loadCGImage(path: String) throws -> (CGImage, Int, Int) {
    guard let image = NSImage(contentsOfFile: path) else {
        throw VisionError.imageLoadFailed("Failed to load image at \(path)")
    }
    var rect = CGRect(origin: .zero, size: image.size)
    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw VisionError.cgImageUnavailable("Failed to convert image to CGImage for \(path)")
    }
    return (cgImage, cgImage.width, cgImage.height)
}

func performOCR(imagePath: String) throws -> OCRResult {
    let (cgImage, width, height) = try loadCGImage(path: imagePath)
    var observations = [VNRecognizedTextObservation]()
    let request = VNRecognizeTextRequest { request, error in
        if let error {
            fail("Vision OCR request failed: \(error.localizedDescription)")
        }
        observations = request.results as? [VNRecognizedTextObservation] ?? []
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.015

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        throw VisionError.requestFailed("Vision OCR request failed: \(error.localizedDescription)")
    }

    let matches = observations.compactMap { observation -> OCRMatch? in
        guard let candidate = observation.topCandidates(1).first else {
            return nil
        }
        let rect = observation.boundingBox
        let pixelWidth = Double(width)
        let pixelHeight = Double(height)
        let left = rect.minX * pixelWidth
        let top = (1.0 - rect.maxY) * pixelHeight
        let boxWidth = rect.width * pixelWidth
        let boxHeight = rect.height * pixelHeight
        return OCRMatch(
            text: candidate.string,
            confidence: Double(candidate.confidence),
            box: OCRBox(
                left: left,
                top: top,
                width: boxWidth,
                height: boxHeight,
                centerX: left + (boxWidth / 2.0),
                centerY: top + (boxHeight / 2.0)
            )
        )
    }

    return OCRResult(ok: true, image: imagePath, width: width, height: height, matches: matches)
}

func mouseButton(named: String) -> CGMouseButton {
    return named == "right" ? .right : .left
}

func mouseTypes(for button: String) -> (CGEventType, CGEventType) {
    if button == "right" {
        return (.rightMouseDown, .rightMouseUp)
    }
    return (.leftMouseDown, .leftMouseUp)
}

func postMouseClick(x: Double, y: Double, clicks: Int, button: String) throws -> ClickResult {
    let point = CGPoint(x: x, y: y)
    let mouseButtonValue = mouseButton(named: button)
    let (downType, upType) = mouseTypes(for: button)
    for clickIndex in 1...clicks {
        guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: mouseButtonValue),
              let down = CGEvent(mouseEventSource: nil, mouseType: downType, mouseCursorPosition: point, mouseButton: mouseButtonValue),
              let up = CGEvent(mouseEventSource: nil, mouseType: upType, mouseCursorPosition: point, mouseButton: mouseButtonValue) else {
            throw VisionError.requestFailed("Failed to create mouse event")
        }
        down.setIntegerValueField(.mouseEventClickState, value: Int64(clickIndex))
        up.setIntegerValueField(.mouseEventClickState, value: Int64(clickIndex))
        move.post(tap: .cghidEventTap)
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
        usleep(90000)
    }
    return ClickResult(ok: true, x: x, y: y, clicks: clicks, button: button)
}

func postMouseDrag(fromX: Double, fromY: Double, toX: Double, toY: Double, steps: Int) throws -> DragResult {
    let start = CGPoint(x: fromX, y: fromY)
    let end = CGPoint(x: toX, y: toY)
    let stepCount = max(steps, 1)
    guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: start, mouseButton: .left),
          let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left),
          let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left) else {
        throw VisionError.requestFailed("Failed to create drag events")
    }
    move.post(tap: .cghidEventTap)
    down.post(tap: .cghidEventTap)
    usleep(90000)

    for step in 1...stepCount {
        let progress = Double(step) / Double(stepCount)
        let current = CGPoint(
            x: start.x + ((end.x - start.x) * progress),
            y: start.y + ((end.y - start.y) * progress)
        )
        guard let drag = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: current, mouseButton: .left) else {
            throw VisionError.requestFailed("Failed to create drag event")
        }
        drag.post(tap: .cghidEventTap)
        usleep(12000)
    }

    up.post(tap: .cghidEventTap)
    return DragResult(ok: true, fromX: fromX, fromY: fromY, toX: toX, toY: toY, steps: stepCount)
}

func postScroll(direction: String, amount: Int) throws -> ScrollResult {
    let lines = max(amount, 1)
    let delta: Int32
    let isHorizontal = direction == "left" || direction == "right"
    switch direction {
    case "up":
        delta = Int32(lines)
    case "down":
        delta = Int32(-lines)
    case "left":
        delta = Int32(-lines)
    case "right":
        delta = Int32(lines)
    default:
        throw VisionError.usage("Unknown scroll direction: \(direction)")
    }
    let wheelCount: UInt32 = isHorizontal ? 2 : 1
    guard let event = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: wheelCount, wheel1: isHorizontal ? 0 : delta, wheel2: isHorizontal ? delta : 0, wheel3: 0) else {
        throw VisionError.requestFailed("Failed to create scroll event")
    }
    event.post(tap: .cghidEventTap)
    return ScrollResult(ok: true, direction: direction, amount: lines)
}

func listScreens() -> ScreensResult {
    let screens = NSScreen.screens.enumerated().map { (index, screen) in
        let frame = screen.frame
        let name = screen.localizedName
        return ScreenInfo(
            index: index,
            name: name,
            x: Double(frame.origin.x),
            y: Double(frame.origin.y),
            width: Double(frame.size.width),
            height: Double(frame.size.height),
            scale: Double(screen.backingScaleFactor),
            isMain: screen == NSScreen.main
        )
    }
    return ScreensResult(ok: true, screens: screens)
}

func clipboardReadImage() throws -> ClipboardResult {
    let pasteboard = NSPasteboard.general
    guard let image = NSImage(pasteboard: pasteboard),
          let tiffData = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiffData),
          let pngData = bitmap.representation(using: .png, properties: [:]) else {
        throw VisionError.requestFailed("No image data available in clipboard")
    }
    let path = "/tmp/steer-clipboard-\(UUID().uuidString.lowercased()).png"
    try pngData.write(to: URL(fileURLWithPath: path))
    return ClipboardResult(ok: true, path: path, type: "image")
}

func clipboardWriteImage(path: String) throws -> ClipboardResult {
    guard let image = NSImage(contentsOfFile: path) else {
        throw VisionError.imageLoadFailed("Failed to load image at \(path)")
    }
    let pasteboard = NSPasteboard.general
    pasteboard.clearContents()
    guard pasteboard.writeObjects([image]) else {
        throw VisionError.requestFailed("Failed to write image to clipboard")
    }
    return ClipboardResult(ok: true, path: path, type: "image")
}

do {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let command = args.first else {
        throw VisionError.usage("Usage: mac_vision.swift <ocr|click|drag|scroll|screens|clipboard-read-image|clipboard-write-image> ...")
    }

    switch command {
    case "ocr":
        guard args.count >= 3, args[1] == "--image" else {
            throw VisionError.usage("Usage: mac_vision.swift ocr --image <path>")
        }
        try encodeAndPrint(performOCR(imagePath: args[2]))
    case "click":
        guard args.count >= 5, args[1] == "--x", args[3] == "--y" else {
            throw VisionError.usage("Usage: mac_vision.swift click --x <x> --y <y> [--clicks <n>] [--button left|right]")
        }
        guard let x = Double(args[2]), let y = Double(args[4]) else {
            throw VisionError.usage("Click coordinates must be numeric")
        }
        var clicks = 1
        var button = "left"
        var index = 5
        while index < args.count {
            if index + 1 >= args.count {
                throw VisionError.usage("Usage: mac_vision.swift click --x <x> --y <y> [--clicks <n>] [--button left|right]")
            }
            switch args[index] {
            case "--clicks":
                guard let parsedClicks = Int(args[index + 1]), parsedClicks > 0 else {
                    throw VisionError.usage("Click count must be positive")
                }
                clicks = parsedClicks
            case "--button":
                let parsedButton = args[index + 1]
                guard parsedButton == "left" || parsedButton == "right" else {
                    throw VisionError.usage("Button must be left or right")
                }
                button = parsedButton
            default:
                throw VisionError.usage("Usage: mac_vision.swift click --x <x> --y <y> [--clicks <n>] [--button left|right]")
            }
            index += 2
        }
        try encodeAndPrint(postMouseClick(x: x, y: y, clicks: clicks, button: button))
    case "scroll":
        guard args.count == 5, args[1] == "--direction", args[3] == "--amount" else {
            throw VisionError.usage("Usage: mac_vision.swift scroll --direction <up|down|left|right> --amount <n>")
        }
        guard let amount = Int(args[4]), amount > 0 else {
            throw VisionError.usage("Scroll amount must be positive")
        }
        try encodeAndPrint(postScroll(direction: args[2], amount: amount))
    case "screens":
        try encodeAndPrint(listScreens())
    case "clipboard-read-image":
        try encodeAndPrint(clipboardReadImage())
    case "clipboard-write-image":
        guard args.count == 3, args[1] == "--image" else {
            throw VisionError.usage("Usage: mac_vision.swift clipboard-write-image --image <path>")
        }
        try encodeAndPrint(clipboardWriteImage(path: args[2]))
    case "drag":
        guard args.count >= 9, args[1] == "--from-x", args[3] == "--from-y", args[5] == "--to-x", args[7] == "--to-y" else {
            throw VisionError.usage("Usage: mac_vision.swift drag --from-x <x> --from-y <y> --to-x <x> --to-y <y> [--steps <n>]")
        }
        guard let fromX = Double(args[2]),
              let fromY = Double(args[4]),
              let toX = Double(args[6]),
              let toY = Double(args[8]) else {
            throw VisionError.usage("Drag coordinates must be numeric")
        }
        var steps = 24
        if args.count >= 11 {
            guard args[9] == "--steps", let parsedSteps = Int(args[10]), parsedSteps > 0 else {
                throw VisionError.usage("Usage: mac_vision.swift drag --from-x <x> --from-y <y> --to-x <x> --to-y <y> [--steps <n>]")
            }
            steps = parsedSteps
        }
        try encodeAndPrint(postMouseDrag(fromX: fromX, fromY: fromY, toX: toX, toY: toY, steps: steps))
    default:
        throw VisionError.usage("Unknown command: \(command)")
    }
} catch {
    fail(error.localizedDescription)
}
