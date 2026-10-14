import { describe, expect, it } from "vitest";

import type {
  VideoFailureReason,
  VideoProcessingStatus,
} from "@/lib/api/contracts";
import {
  failureReasonCopy,
  formatDuration,
  processingStatusCopy,
  publicVideoUrl,
  qualityLabel,
} from "@/lib/videos/format";

describe("formatDuration", () => {
  it("formats durations under one hour as m:ss", () => {
    expect(formatDuration(941_000)).toBe("15:41");
    expect(formatDuration(5_000)).toBe("0:05");
  });

  it("formats durations from one hour up as h:mm:ss", () => {
    expect(formatDuration(3_723_000)).toBe("1:02:03");
    expect(formatDuration(3_600_000)).toBe("1:00:00");
  });

  it("returns an em dash for null", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("qualityLabel", () => {
  it.each([
    [1280, 720, "720p HD"],
    [1920, 1080, "1080p HD"],
    [2560, 1440, "1440p"],
    [3840, 2160, "4K"],
    [640, 360, "360p"],
  ])("labels %ix%i as %s", (width, height, label) => {
    expect(qualityLabel(width, height)).toBe(label);
  });

  it("gives portrait and landscape the same label", () => {
    expect(qualityLabel(1080, 1920)).toBe(qualityLabel(1920, 1080));
  });

  it("returns an em dash when any dimension is null", () => {
    expect(qualityLabel(null, null)).toBe("—");
    expect(qualityLabel(1920, null)).toBe("—");
  });
});

describe("copy", () => {
  // Record<> typing in format.ts already forces completeness at compile time;
  // these keys mirror the contract unions to catch empty strings at runtime.
  const statuses: VideoProcessingStatus[] = [
    "awaiting_upload",
    "uploaded",
    "processing",
    "ready",
    "failed",
  ];
  const reasons: VideoFailureReason[] = [
    "not_a_video",
    "unreadable_file",
    "unsupported_media",
    "processing_error",
    "upload_abandoned",
  ];

  it.each(statuses)("has non-empty copy for status %s", (status) => {
    expect(processingStatusCopy(status).trim()).not.toBe("");
  });

  it.each(reasons)("has non-empty copy for failure reason %s", (reason) => {
    expect(failureReasonCopy(reason).trim()).not.toBe("");
  });
});

describe("publicVideoUrl", () => {
  it("joins origin and publicId under /v", () => {
    expect(publicVideoUrl("https://streamtube.test", "dQw4w9WgXcQ")).toBe(
      "https://streamtube.test/v/dQw4w9WgXcQ",
    );
  });
});
