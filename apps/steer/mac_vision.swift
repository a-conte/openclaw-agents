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

func postMouseClick(x: Double, y: Double, clicks: Int) throws -> ClickResult {
    let point = CGPoint(x: x, y: y)
    for clickIndex in 1...clicks {
        guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left),
              let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left),
              let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) else {
            throw VisionError.requestFailed("Failed to create mouse event")
        }
        down.setIntegerValueField(.mouseEventClickState, value: Int64(clickIndex))
        up.setIntegerValueField(.mouseEventClickState, value: Int64(clickIndex))
        move.post(tap: .cghidEventTap)
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
        usleep(90000)
    }
    return ClickResult(ok: true, x: x, y: y, clicks: clicks)
}

do {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let command = args.first else {
        throw VisionError.usage("Usage: mac_vision.swift <ocr|click> ...")
    }

    switch command {
    case "ocr":
        guard args.count >= 3, args[1] == "--image" else {
            throw VisionError.usage("Usage: mac_vision.swift ocr --image <path>")
        }
        try encodeAndPrint(performOCR(imagePath: args[2]))
    case "click":
        guard args.count >= 5, args[1] == "--x", args[3] == "--y" else {
            throw VisionError.usage("Usage: mac_vision.swift click --x <x> --y <y> [--clicks <n>]")
        }
        guard let x = Double(args[2]), let y = Double(args[4]) else {
            throw VisionError.usage("Click coordinates must be numeric")
        }
        var clicks = 1
        if args.count >= 7 {
            guard args[5] == "--clicks", let parsedClicks = Int(args[6]), parsedClicks > 0 else {
                throw VisionError.usage("Usage: mac_vision.swift click --x <x> --y <y> [--clicks <n>]")
            }
            clicks = parsedClicks
        }
        try encodeAndPrint(postMouseClick(x: x, y: y, clicks: clicks))
    default:
        throw VisionError.usage("Unknown command: \(command)")
    }
} catch {
    fail(error.localizedDescription)
}
